import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { migrateLegacyJson, Store, type UserRow } from './server/database';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Images are analysed in the browser; the server only receives text and telemetry.
app.use(express.json({ limit: '3mb' }));

// --- Simple in-memory rate limiter (per IP, fixed window) ---
function rateLimit(maxRequests: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > maxRequests) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({ error: 'Muitos pedidos seguidos. Aguarde um pouco e tente novamente.' });
    }
    return next();
  };
}

const aiRateLimit = rateLimit(30, 10 * 60 * 1000);
const authRateLimit = rateLimit(20, 15 * 60 * 1000);

// Hardcoded Official Geospatial & Planetary Scientific API Endpoints
const HARDCODED_OFFICIAL_APIS = {
  OPENTOPODATA_SRTM90M: 'https://api.opentopodata.org/v1/srtm90m',
  NASA_EONET_V3: 'https://eonet.gsfc.nasa.gov/api/v3/events?limit=80&status=open',
  NASA_GIBS_WMTS:
    'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2024-06-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
  OPENTOPOMAP_DEM: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  USGS_EARTHQUAKE_API:
    'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=8&minmagnitude=4.5',
} as const;

// SQLite database (see server/database.ts). Data from the old JSON files is imported once.
const LOCAL_DB_DIR = path.resolve(__dirname, '.local-data');
const store = new Store(process.env.DATABASE_FILE || path.join(LOCAL_DB_DIR, 'african-analogs.sqlite'));
{
  const migrated = migrateLegacyJson(store, LOCAL_DB_DIR);
  if (migrated.length) console.log(`Dados antigos (JSON) importados para SQLite: ${migrated.join(', ')}.`);
}

// NVIDIA NIM AI configuration — the key comes from the environment (.env), never from source code.
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY?.trim() || '';
const NVIDIA_BASE_URL = process.env.NVIDIA_BASE_URL?.trim() || 'https://integrate.api.nvidia.com/v1';
const NVIDIA_MODEL = process.env.NVIDIA_MODEL?.trim() || 'nvidia/nemotron-3.5-lightning-30b-a3b';
const AI_CONFIGURED = NVIDIA_API_KEY.length > 0;

if (!AI_CONFIGURED) {
  console.warn('NVIDIA_API_KEY não definida: as rotas de IA vão responder 503. Configure-a no ficheiro .env.');
}

const openai = new OpenAI({
  apiKey: NVIDIA_API_KEY || 'missing',
  baseURL: NVIDIA_BASE_URL,
});

class AiNotConfiguredError extends Error {}

interface NemotronMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function runNemotronCompletion(
  messages: NemotronMessage[]
): Promise<{ content: string; reasoning: string }> {
  if (!AI_CONFIGURED) {
    throw new AiNotConfiguredError('O copiloto de IA não está configurado no servidor (falta NVIDIA_API_KEY).');
  }
  const completion = await (openai.chat.completions.create as any)({
    model: NVIDIA_MODEL,
    messages,
    // Lower temperature keeps scientific answers consistent between runs.
    temperature: 0.4,
    top_p: 0.95,
    max_tokens: 8192,
    reasoning_budget: 4096,
    chat_template_kwargs: { enable_thinking: true },
    stream: true,
  });

  let reasoning = '';
  let content = '';

  for await (const chunk of completion) {
    const delta = chunk.choices?.[0]?.delta as
      | { content?: string | null; reasoning_content?: string | null }
      | undefined;
    if (delta?.reasoning_content) {
      reasoning += delta.reasoning_content;
    }
    if (delta?.content) {
      content += delta.content;
    }
  }

  return {
    content: content.trim(),
    reasoning: reasoning.trim(),
  };
}

// Interactive AI Research Copilot (Prompt, Document/CSV & Optional Location)
app.post('/api/ai/chat', aiRateLimit, async (req, res) => {
  try {
    const {
      messages = [],
      prompt,
      documentContent,
      documentName,
      targetPlanet = 'Mars',
      coordinates,
      useLocation = false,
      siteContext,
      activeSample,
    } = req.body;

    const systemInstruction = `Você é o Copiloto Analista Científico da plataforma colaborativa African Analogs (alinhado aos catálogos oficiais NASA PDS, OpenTopography SRTM DEM, USGS e ESA Europlanet).
Sua missão é atuar como copiloto de análise para ajudar pesquisadores e estudantes a interpretar dados inseridos manualmente sobre lugares análogos na Terra (especialmente na África e referências globais da NASA) para Marte, Lua, Europa, Encélado, Titã e Vênus.

Conhecimento de referência:
1. Sítios Análogos Africanos & Globais: Depressão de Danakil & Dallol (Etiópia - Marte/Vênus hidrotermal hiperácido), Estrutura de Richat (Mauritânia - calibração orbital/Marte), Mar de Areia do Namibe (Namíbia - dunas lineares de Titã/Marte), Domo de Impacto de Vredefort (África do Sul - brechas e quartzo chocado da Lua), Lago Natron (Tanzânia - lagos alcalinos carbonatados de Encélado), Deserto do Atacama (Chile), Lanzarote (Espanha), Borup Fiord Pass (Ártico - Europa).
2. Análise de Documentos & CSV: Extraia padrões geoquímicos (aw, pH, óxidos XRF, minerais XRD), avalie limitações de habitabilidade/astrobiologia e comente o índice de semelhança/fidelidade análoga (AFI).
3. Localização Opcional: Se o usuário fornecer coordenadas GPS ou sítio geográfico, relacione relevo, litologia regional e contexto topográfico DEM; caso contrário, analise estritamente pelos parâmetros manuais e documentos enviados.

Diretrizes de resposta:
- Responda em Português claro, estruturado e acessível (tópicos curtos, análogo terrestre mais próximo, pontos fortes, limites e recomendações práticas).
- Não invente medições que o pesquisador não forneceu; ajude-o a interpretar os dados manuais.`;

    let contextPrompt = '';
    if (siteContext) {
      contextPrompt += `\n[SÍTIO DE REFERÊNCIA NO MAPA: ${siteContext.name} (${siteContext.country || ''}) | Alvo: ${siteContext.targetPlanet} | Semelhança: ${siteContext.fidelityScore}%]\n`;
    }
    if (useLocation && coordinates && (coordinates.lat !== undefined || Array.isArray(coordinates))) {
      const lat = Array.isArray(coordinates) ? coordinates[0] : coordinates.lat;
      const lng = Array.isArray(coordinates) ? coordinates[1] : coordinates.lng;
      contextPrompt += `\n[LOCALIZAÇÃO EM TEMPO REAL FORNECIDA: Latitude ${lat}°, Longitude ${lng}°]\n`;
    }
    if (activeSample) {
      contextPrompt += `\n[DADOS MANUAIS ATIVOS: "${activeSample.name}" | Lugar: ${activeSample.customLocation || siteContext?.name || 'Não informado'} | Minerais: ${JSON.stringify(activeSample.minerals)} | Umidade (aw): ${activeSample.waterActivity} | pH: ${activeSample.pH}]\n`;
    }
    if (documentContent) {
      const trimmedDoc = String(documentContent).slice(0, 12000);
      contextPrompt += `\n[CONTEÚDO DO DOCUMENTO / CSV ANEXADO (${documentName || 'arquivo_pesquisa'})]:\n\`\`\`\n${trimmedDoc}\n\`\`\`\n`;
    }

    const nemotronMessages: NemotronMessage[] = [
      { role: 'system', content: `${systemInstruction}\nRespond in ${req.body.lang === 'en' ? 'English' : 'Portuguese'}.` },
    ];

    if (contextPrompt) {
      nemotronMessages.push({
        role: 'user',
        content: `Contexto técnico desta sessão de pesquisa:\n${contextPrompt}`,
      });
      nemotronMessages.push({
        role: 'assistant',
        content: 'Contexto e dados manuais carregados. Pronto para atuar como copiloto na análise.',
      });
    }

    if (Array.isArray(messages) && messages.length > 0) {
      for (const msg of messages) {
        nemotronMessages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: String(msg.content || ''),
        });
      }
    } else if (prompt) {
      nemotronMessages.push({
        role: 'user',
        content: `Corpo planetário de interesse: ${targetPlanet}.\nSolicitação do usuário: ${prompt}`,
      });
    } else if (documentContent) {
      nemotronMessages.push({
        role: 'user',
        content: `Analise o documento/CSV anexado acima para o corpo planetário ${targetPlanet}, identifique o sítio análogo terrestre mais compatível e apresente um parecer técnico claro.`,
      });
    }

    if (nemotronMessages.length <= 1) {
      return res.status(400).json({
        error: 'Forneça uma pergunta de pesquisa ou anexe um documento/CSV para iniciar a análise.',
      });
    }

    const { content, reasoning } = await runNemotronCompletion(nemotronMessages);
    return res.json({ reply: content, reasoning, model: NVIDIA_MODEL });
  } catch (error: any) {
    console.error('Erro na rota /api/ai/chat:', error);
    return res.status(error instanceof AiNotConfiguredError ? 503 : 500).json({
      error: error.message || 'Falha ao processar solicitação com a IA NVIDIA Nemotron.',
    });
  }
});

// Computer Vision & Real-time Location Analysis via Measured Pixel Telemetry + Raster Metadata + Nemotron Copilot
app.post('/api/ai/vision-analyze', aiRateLimit, async (req, res) => {
  try {
    const {
      coordinates,
      targetPlanet = 'Mars',
      rasterMetadata,
      visualTelemetry,
      visualNotes,
    } = req.body;

    if (!visualTelemetry && !rasterMetadata && !visualNotes) {
      return res.status(400).json({ error: 'Nenhuma imagem ou telemetria visual fornecida para análise.' });
    }

    const targetLabelMap: Record<string, string> = {
      Mercury: 'MERCÚRIO',
      Venus: 'VÊNUS',
      Earth: 'TERRA (REFERÊNCIA)',
      Mars: 'MARTE',
      Jupiter: 'JÚPITER',
      Saturn: 'SATURNO',
      Uranus: 'URANO',
      Neptune: 'NETUNO',
      Ceres: 'CERES (PLANETA ANÃO)',
      Pluto: 'PLUTÃO (PLANETA ANÃO)',
      Moon: 'LUA (TERRA)',
      Phobos: 'FOBOS (MARTE)',
      Deimos: 'DEIMOS (MARTE)',
      Io: 'IO (JÚPITER)',
      Europa: 'EUROPA (JÚPITER)',
      Ganymede: 'GANIMEDES (JÚPITER)',
      Callisto: 'CALISTO (JÚPITER)',
      Mimas: 'MIMAS (SATURNO)',
      Enceladus: 'ENCÉLADO (SATURNO)',
      Tethys: 'TÉTIS (SATURNO)',
      Dione: 'DIONE (SATURNO)',
      Rhea: 'REIA (SATURNO)',
      Titan: 'TITÃ (SATURNO)',
      Iapetus: 'JÁPETO (SATURNO)',
      Miranda: 'MIRANDA (URANO)',
      Ariel: 'ARIEL (URANO)',
      Umbriel: 'UMBRIEL (URANO)',
      Titania: 'TITÂNIA (URANO)',
      Oberon: 'OBERON (URANO)',
      Triton: 'TRITÃO (NETUNO)',
      Charon: 'CARONTE (PLUTÃO)',
      Both: 'MARTE e LUA',
    };
    const targetLabel = targetLabelMap[targetPlanet] || String(targetPlanet || 'MARTE').toUpperCase();

    const rasterContext = rasterMetadata
      ? `\n[METADADOS DO RASTER / TIFF / DESCRIPTOGRAFIA]: Formato: ${rasterMetadata.detectedFormat || 'Raster'} | Arquivo: ${rasterMetadata.originalFileName || 'campo'} | Dimensões: ${rasterMetadata.width || '?'}x${rasterMetadata.height || '?'} px | Bandas: ${rasterMetadata.bands || 1} (${rasterMetadata.bitsPerSample || 8}-bit) | Min/Média/Máx: ${rasterMetadata.minVal ?? '-'} / ${rasterMetadata.meanVal ?? '-'} / ${rasterMetadata.maxVal ?? '-'}${rasterMetadata.wasEncrypted ? ` | Descriptografado via: ${rasterMetadata.decryptionMethod}` : ''}\n`
      : '';

    const telemetryContext = visualTelemetry
      ? `\n[TELEMETRIA VISUAL MEDIDA DA IMAGEM]: Cor predominante: ${visualTelemetry.dominantColorTag || 'Neutra'} | RGB médio: (${visualTelemetry.meanRed ?? '-'}, ${visualTelemetry.meanGreen ?? '-'}, ${visualTelemetry.meanBlue ?? '-'}) | Albedo/Brilho estimado: ${visualTelemetry.brightnessAlbedo ?? '-'} | Índice de Óxido de Ferro (R-B): ${visualTelemetry.ironOxideIndex ?? '-'} | Contraste/Rugosidade superficial: ${visualTelemetry.surfaceContrast ?? '-'} | Dimensões: ${visualTelemetry.width || '?'}x${visualTelemetry.height || '?'} px\n`
      : '';

    const notesContext = visualNotes ? `\n[OBSERVAÇÃO VISUAL DO USUÁRIO SOBRE A FOTO]: ${visualNotes}\n` : '';

    const promptText = `Você é o sistema de apoio à Visão Geológica e Reconhecimento de Terrenos Planetários da plataforma African Analogs.
Analise os dados visuais extraídos desta imagem de terreno, rocha, DEM GeoTIFF ou superfície capturada ${coordinates ? `nas coordenadas [Lat: ${coordinates.lat}, Lng: ${coordinates.lng}]` : 'em campo'}.${rasterContext}${telemetryContext}${notesContext}

Avalie se este terreno/rocha possui características análogas às de ${targetLabel}.

Responda obrigatoriamente neste formato textual exato em ${req.body.lang === 'en' ? 'English' : 'Portuguese'}, mantendo os nomes das tags (NÃO coloque parênteses ao redor das respostas):
[CORPO_ANALOGO_PROVAVEL]: nome em inglês do planeta ou satélite natural mais compatível (ex: Mercury, Venus, Mars, Moon, Phobos, Io, Europa, Ganymede, Callisto, Enceladus, Titan, Triton, Ceres, Pluto, etc.)
[ESCORE_FIDELIDADE]: número inteiro de 0 a 100
[ANALOGO_TERRESTRE_MAIS_PROXIMO]: ex: Depressão de Danakil & Dallol, Estrutura de Richat, Mar de Areia do Namibe, Domo de Impacto de Vredefort, Lago Natron, Deserto do Atacama, Geopark de Lanzarote ou Borup Fiord Pass
[FEICOES_GEOLOGICAS_IDENTIFICADAS]: 4 a 6 feições visuais separadas por ponto e vírgula
[MINERAIS_DETECTADOS_VISAO]: 2 a 4 minerais prováveis separados por vírgula
[ADEQUACAO_INSTRUMENTAL]: instrumentos espaciais separados por vírgula
[DIAGNOSTICO_CIENTIFICO]: parecer claro em 3 a 5 linhas, sem enrolação`;

    const { content: reply, reasoning } = await runNemotronCompletion([
      {
        role: 'system',
        content:
          `Você é um especialista em geomorfologia comparada planetária da NASA/ESA atuando como copiloto visual. Responda em ${req.body.lang === 'en' ? 'English' : 'Portuguese'} no formato de tags solicitado sem usar parênteses em volta dos valores.`,
      },
      { role: 'user', content: promptText },
    ]);

    const cleanOuterParens = (val: string) => val.replace(/^\(([\s\S]*)\)$/, '$1').trim();

    // Missing tags stay empty: never substitute plausible-looking values the model did not give.
    const extract = (tag: string): string | null => {
      const regex = new RegExp(`\\[${tag}\\]:\\s*(.+?)(?=\\n\\[|$)`, 's');
      const match = reply.match(regex);
      return match ? cleanOuterParens(match[1].trim()) : null;
    };

    const planetaryMatch = extract('CORPO_ANALOGO_PROVAVEL');
    const scoreStr = extract('ESCORE_FIDELIDADE');
    const parsedScore = scoreStr ? parseInt(scoreStr.replace(/\D/g, ''), 10) : NaN;
    const fidelityScore = Number.isFinite(parsedScore) ? Math.min(100, Math.max(0, parsedScore)) : null;
    const closestAnalogue = extract('ANALOGO_TERRESTRE_MAIS_PROXIMO');
    const featuresRaw = extract('FEICOES_GEOLOGICAS_IDENTIFICADAS') || '';
    const mineralsRaw = extract('MINERAIS_DETECTADOS_VISAO') || '';
    const instruments = extract('ADEQUACAO_INSTRUMENTAL');
    const diagnosis = extract('DIAGNOSTICO_CIENTIFICO') || reply;
    const parsedOk = planetaryMatch !== null && fidelityScore !== null;

    const featureDelimiter = featuresRaw.includes(';') ? /[;\n•]+/ : /[,;\n•]+(?![^()]*\))/;

    return res.json({
      success: true,
      parsedOk,
      basis: 'Estatísticas de pixels medidas no navegador + metadados + notas do utilizador (o modelo não vê a imagem).',
      rawText: reply,
      reasoning,
      model: NVIDIA_MODEL,
      planetaryMatch,
      fidelityScore,
      closestAnalogue,
      features: featuresRaw.split(featureDelimiter).map((s) => cleanOuterParens(s.trim())).filter((s) => s.length > 2),
      minerals: mineralsRaw.split(/[,;\n•]+/).map((s) => cleanOuterParens(s.trim())).filter((s) => s.length > 2),
      instruments,
      diagnosis,
    });
  } catch (error: any) {
    console.error('Erro na visão computacional:', error);
    return res.status(error instanceof AiNotConfiguredError ? 503 : 500).json({
      error: error.message || 'Falha ao processar análise visual com NVIDIA Nemotron.',
    });
  }
});

// Menu-driven Scientific Diagnostics Pathway
app.post('/api/ai/diagnostics', aiRateLimit, async (req, res) => {
  try {
    const { action, sample, site, targetPlanet, coordinates } = req.body;

    const actionPrompts: Record<string, string> = {
      selected_target_match: `Avalie a compatibilidade da amostra "${sample?.name || 'Amostra de Campo'}" (${sample?.customLocation || site?.name || 'Sítio'}) como análogo terrestre para o corpo planetário/satélite natural "${targetPlanet || 'Mars'}". Analise minerais: ${JSON.stringify(sample?.minerals || {})}, umidade aw: ${sample?.waterActivity}, pH: ${sample?.pH}, limites e oportunidades de estudo.`,
      mars_jezero_match: `Avalie a compatibilidade da amostra "${sample?.name || 'Amostra de Campo'}" (${sample?.customLocation || site?.name || 'Sítio'}) com os estratos sedimentares do delta e cratera de Jezero (Marte). Analise minerais presentes: ${JSON.stringify(sample?.minerals || {})}, aw: ${sample?.waterActivity}, pH: ${sample?.pH}.`,
      moon_shackleton_match: `Avalie a equivalência da amostra "${sample?.name || 'Amostra'}" com o regolito da Bacia Polo Sul-Aitken e Cratera Shackleton (Lua), focando em anortosito, piroxênio, ilmenita, pseudotaquilito e voláteis criogênicos.`,
      europa_ice_brine_match: `Avalie a correspondência da amostra com a crosta de gelo e surgências de salmoura rica em sulfatos hidratados de Europa (Júpiter) visando o espectrômetro MISE da sonda Europa Clipper.`,
      enceladus_serpentine_plume: `Avalie o potencial da amostra como análogo para o oceano hidrotermal de Encélado (Saturno), com foco em serpentinização abiótica, carbonatos de sódio (trona/natrão) e pH hiperalcalino.`,
      titan_hydrocarbon_dune: `Avalie a analogia da amostra e morfologia do sítio ${sample?.customLocation || site?.name || ''} com as dunas orgânicas e lagos de Titã (Saturno) para a missão Dragonfly.`,
      venus_supercritical_volcano: `Avalie a equivalência mineralógica com as planícies vulcânicas basálticas sob atmosfera densa de Vênus (missões VERITAS e DAVINCI).`,
      rover_instrument_simulation: `Simule o que instrumentos de rover espacial (SuperCam, PIXL, SHERLOC) detectariam na amostra manual "${sample?.name || ''}".`,
      extremophile_biosignature: `Analise a chance de água, habitabilidade e preservação de bioassinaturas considerando umidade aw=${sample?.waterActivity || 0.3}, pH=${sample?.pH || 7} no local ${sample?.customLocation || site?.name || ''}.`,
      isru_resource_detection: `Analise recursos úteis no local (extração de água ou oxigênio a partir dos minerais) na amostra "${sample?.name || ''}".`,
    };

    const chosenPrompt =
      actionPrompts[action] ||
      `Realize um diagnóstico analítico da amostra ${sample?.name || 'geológica'} (${targetPlanet || 'Mars'}, coordenadas ${JSON.stringify(coordinates || [])}).`;

    const systemInstruction = `Você é o copiloto técnico da plataforma African Analogs. Forneça diagnósticos claros, objetivos e úteis em ${req.body.lang === 'en' ? 'English' : 'Portuguese'}.
Estruture a resposta com:
1. Resumo Direto (2 linhas)
2. Avaliação dos Dados Manuais
3. Pontos Fortes e Pontos de Atenção
4. Recomendação Prática para o Estudo.`;

    const { content, reasoning } = await runNemotronCompletion([
      { role: 'system', content: systemInstruction },
      { role: 'user', content: chosenPrompt },
    ]);

    return res.json({ result: content, reasoning, model: NVIDIA_MODEL });
  } catch (error: any) {
    console.error('Erro na rota de diagnósticos:', error);
    return res.status(error instanceof AiNotConfiguredError ? 503 : 500).json({
      error: error.message || 'Falha ao executar diagnóstico.',
    });
  }
});

// Formal Planetary Analogue Technical Report Generator (Copilot Draft)
app.post('/api/ai/generate-report', aiRateLimit, async (req, res) => {
  try {
    const { sample, site, visionData, attachedDiagnostics, targetPlanet, investigator } = req.body;

    const reportPrompt = `Gere um Resumo Técnico de Apoio para o estudo de lugar análogo planetário na plataforma African Analogs:
Investigador / Autor: ${investigator || 'Pesquisador Responsável'}
Alvo Planetário: ${targetPlanet || 'Mars'}
Lugar Informado Manualmente: ${sample?.customLocation || site?.name || 'Localização de Amostragem'} (${site?.country || ''})
Origem dos Dados: ${sample?.officialSource || site?.dataSource || 'Registro Manual'}
Amostra: ${sample?.name || 'Amostra de Campo'}
Tipo de Rocha/Solo: ${sample?.rockClassification || 'Solo / Rocha Natural'}
Parâmetros Manuais: umidade aw=${sample?.waterActivity}, pH=${sample?.pH}, Profundidade=${sample?.depthCm}cm
Minerais Informados: ${JSON.stringify(sample?.minerals || {})}
Composição Química: ${JSON.stringify(sample?.xrfComposition || {})}
Notas do Autor: ${sample?.fieldNotes || ''}
${visionData ? `Observações Visuais de Apoio: ${JSON.stringify(visionData)}` : ''}
${attachedDiagnostics ? `Análises Anteriores do Copiloto: ${attachedDiagnostics}` : ''}

Use a seguinte estrutura, traduzindo os títulos e o conteúdo para ${req.body.lang === 'en' ? 'English' : 'Portuguese'}:
# RESUMO DA PESQUISA — AFRICAN ANALOGS
## 1. VISÃO GERAL E LOCAL ESTUDADO
## 2. INTERPRETAÇÃO DO SOLO, MINERAIS E UMIDADE
## 3. SEMELHANÇAS COM ${String(targetPlanet || 'MARTE').toUpperCase()} E LIMITES DO TESTE
## 4. RECOMENDAÇÕES PRÁTICAS PARA CONTINUAR O ESTUDO
## 5. SUGESTÃO DE CONCLUSÃO PARA ARTIGO`;

    const { content, reasoning } = await runNemotronCompletion([
      {
        role: 'system',
        content:
          'Você é o copiloto editorial da plataforma African Analogs. Redija um resumo técnico claro, organizado e fiel exclusivamente aos dados fornecidos pelo pesquisador.',
      },
      { role: 'user', content: reportPrompt },
    ]);

    return res.json({ report: content, reasoning, model: NVIDIA_MODEL });
  } catch (error: any) {
    console.error('Erro na geração de relatório:', error);
    return res.status(error instanceof AiNotConfiguredError ? 503 : 500).json({
      error: error.message || 'Falha ao emitir resumo com o copiloto.',
    });
  }
});

// Hardcoded Official API Catalog, SRTM DEM Elevation & NASA EONET Live Events
app.get('/api/official/catalog', (_req, res) => {
  return res.json({
    endpoints: HARDCODED_API_APIS_SAFE(),
    aiConfigured: AI_CONFIGURED,
    aiModel: NVIDIA_MODEL,
    aiProvider: 'NVIDIA NIM',
    storageMode: 'local-persistent',
  });
});

function HARDCODED_API_APIS_SAFE() {
  return {
    ...HARDCODED_OFFICIAL_APIS,
    NVIDIA_NIM_BASE_URL: NVIDIA_BASE_URL,
    NVIDIA_NIM_MODEL: NVIDIA_MODEL,
  };
}

app.get('/api/official/elevation', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'Latitude e longitude inválidas.' });
  }
  try {
    const url = `${HARDCODED_OFFICIAL_APIS.OPENTOPODATA_SRTM90M}?locations=${lat},${lng}`;
    const apiRes = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!apiRes.ok) {
      return res.json({ elevationMeters: null, dataset: 'srtm90m', source: 'upstream-unavailable' });
    }
    const payload: any = await apiRes.json();
    const elevation = payload?.results?.[0]?.elevation;
    return res.json({
      elevationMeters: typeof elevation === 'number' ? Math.round(elevation) : null,
      dataset: 'NASA SRTM 90m (OpenTopoData)',
      source: HARDCODED_OFFICIAL_APIS.OPENTOPODATA_SRTM90M,
    });
  } catch {
    return res.json({ elevationMeters: null, dataset: 'srtm90m', source: 'timeout-fallback' });
  }
});

// EONET can be slow or briefly unreachable; keep the last good answer for 10 minutes
// and serve it (marked stale) when a refresh fails.
const EONET_CACHE_TTL_MS = 10 * 60 * 1000;
let eonetCache: { at: number; events: unknown[] } | null = null;

app.get('/api/official/nasa-events', async (_req, res) => {
  if (eonetCache && Date.now() - eonetCache.at < EONET_CACHE_TTL_MS) {
    return res.json({ events: eonetCache.events, source: HARDCODED_OFFICIAL_APIS.NASA_EONET_V3, cached: true });
  }
  const staleFallback = () =>
    res.json({
      events: eonetCache?.events || [],
      source: HARDCODED_OFFICIAL_APIS.NASA_EONET_V3,
      stale: Boolean(eonetCache),
    });
  try {
    const apiRes = await fetch(HARDCODED_OFFICIAL_APIS.NASA_EONET_V3, {
      signal: AbortSignal.timeout(12000),
    });
    if (!apiRes.ok) {
      return staleFallback();
    }
    const data: any = await apiRes.json();
    const events = (data?.events || []).slice(0, 80).map((ev: any) => {
      // EONET lists observations chronologically; the last one is the event's current position.
      const geo = Array.isArray(ev.geometry) ? ev.geometry[ev.geometry.length - 1] : undefined;
      // Point → [lng, lat]; Polygon → [[[lng, lat], ...]] (use its first vertex).
      const raw = geo?.type === 'Polygon' ? geo.coordinates?.[0]?.[0] : geo?.coordinates;
      const coords =
        Array.isArray(raw) && typeof raw[0] === 'number' && typeof raw[1] === 'number'
          ? ([raw[1], raw[0]] as [number, number])
          : undefined;
      return {
        id: ev.id,
        title: ev.title,
        category: ev.categories?.[0]?.title || 'Evento Natural',
        date: geo?.date ? String(geo.date).slice(0, 10) : '',
        coordinates: coords,
      };
    });
    eonetCache = { at: Date.now(), events };
    return res.json({ events, source: HARDCODED_OFFICIAL_APIS.NASA_EONET_V3 });
  } catch (err) {
    console.warn('NASA EONET indisponível:', (err as any)?.cause?.code || (err as Error)?.message);
    return staleFallback();
  }
});

// ---------------------------------------------------------------------------
// Authentication: credentials live only in the database (scrypt), never in the browser.
// ---------------------------------------------------------------------------
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password: string, user: UserRow): boolean {
  const candidate = crypto.scryptSync(password, user.salt, 64);
  const expected = Buffer.from(user.hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

function newSession(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  store.createSession(token, userId, Date.now() + SESSION_TTL_MS);
  return token;
}

function bearerToken(req: express.Request): string {
  const header = req.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function sessionUserId(req: express.Request): string | null {
  const token = bearerToken(req);
  return token ? store.sessionUser(token) : null;
}

/** Express middleware: rejects requests without a valid session and exposes res.locals.userId. */
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const userId = sessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'Sessão expirada ou inexistente. Entre na sua conta.' });
  res.locals.userId = userId;
  return next();
}

const publicAccount = (u: UserRow) => ({
  id: u.id,
  email: u.email,
  codename: u.codename,
  profileId: u.id,
  createdAt: u.created_at,
  updatedAt: u.updated_at,
});

const normalizeEmail = (v: unknown) => String(v ?? '').trim().toLowerCase();
const normalizeCodenameServer = (v: unknown) => {
  const raw = String(v ?? '').trim().toLowerCase();
  return raw.startsWith('@') ? raw : `@${raw}`;
};
const asId = (v: unknown) => (typeof v === 'string' && /^[A-Za-z0-9._:-]{1,120}$/.test(v) ? v : null);
const isObject = (v: unknown): v is Record<string, any> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

app.post('/api/auth/register', authRateLimit, (req, res) => {
  const { id, email, codename, password } = req.body || {};
  const cleanEmail = normalizeEmail(email);
  const cleanCodename = normalizeCodenameServer(codename);
  const userId = typeof id === 'string' && /^[a-z0-9-]{4,64}$/i.test(id) ? id : `usr-${crypto.randomUUID()}`;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: 'E-mail inválido.' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres.' });
  }
  if (store.emailTaken(cleanEmail)) return res.status(409).json({ error: 'Já existe uma conta com este e-mail.' });
  if (store.codenameTaken(cleanCodename)) return res.status(409).json({ error: `O codinome ${cleanCodename} já está em uso.` });
  if (store.findUserById(userId)) return res.status(409).json({ error: 'Identificador de conta já existe.' });

  const now = new Date().toISOString();
  const { salt, hash } = hashPassword(password);
  const user: UserRow = { id: userId, email: cleanEmail, codename: cleanCodename, salt, hash, created_at: now, updated_at: now };
  store.insertUser(user);
  return res.status(201).json({ account: publicAccount(user), token: newSession(userId) });
});

app.post('/api/auth/login', authRateLimit, (req, res) => {
  const { identifier, password } = req.body || {};
  if (typeof identifier !== 'string' || typeof password !== 'string' || !identifier.trim()) {
    return res.status(400).json({ error: 'Indique e-mail/codinome e senha.' });
  }
  const id = identifier.trim().toLowerCase();
  const user = store.findUserByLogin(id) || store.findUserByLogin(normalizeCodenameServer(id));
  if (!user || !verifyPassword(password, user)) {
    return res.status(401).json({ error: 'E-mail/codinome ou senha incorretos.' });
  }
  return res.json({ account: publicAccount(user), token: newSession(user.id) });
});

app.post('/api/auth/password', authRateLimit, requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const user = store.findUserById(res.locals.userId);
  if (!user || typeof currentPassword !== 'string' || !verifyPassword(currentPassword, user)) {
    return res.status(401).json({ error: 'Senha atual incorreta.' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'A nova senha deve ter pelo menos 8 caracteres.' });
  }
  const { salt, hash } = hashPassword(newPassword);
  store.updatePassword(user.id, salt, hash);
  return res.json({ ok: true });
});

app.post('/api/auth/logout', (req, res) => {
  const token = bearerToken(req);
  if (token) store.deleteSession(token);
  return res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Shared research data. Everyone can read; each record can only be changed by its
// owner, and every write touches one record (no more "last writer wins" on whole lists).
// Private data (e-mails, direct messages, personal connections) is never stored here.
// ---------------------------------------------------------------------------
const REQUIRED_ENDORSEMENTS = 2;

/** Mirrors src/services/peerReview.ts so the rule is enforced by the server too. */
function derivedStatus(sample: Record<string, any>): string {
  const endorsers = new Set(
    (sample.peerComments || [])
      .filter((c: any) => c.statusChange === 'approved' && c.authorId && c.authorId !== sample.collaboratorId)
      .map((c: any) => c.authorId)
  );
  if (endorsers.size >= REQUIRED_ENDORSEMENTS) return 'verified_peer_reviewed';
  return sample.status === 'draft' ? 'draft' : 'under_review';
}

app.get('/api/data', (_req, res) => {
  return res.json({
    customProfiles: store.listProfiles(),
    samples: store.listSamples().map((s) => ({ ...s, status: derivedStatus(s) })),
    studyThreads: store.listStudyThreads(),
    networkGroups: store.listGroups(),
  });
});

// Own public profile (e-mail is never stored with it).
app.put('/api/profiles/me', requireAuth, (req, res) => {
  if (!isObject(req.body)) return res.status(400).json({ error: 'Formato inválido.' });
  const userId: string = res.locals.userId;
  const { email: _email, ...profile } = req.body;
  if (profile.codename) {
    const codename = normalizeCodenameServer(profile.codename);
    if (store.codenameTaken(codename, userId)) return res.status(409).json({ error: `O codinome ${codename} já está em uso.` });
    store.updateCodename(userId, codename);
    profile.codename = codename;
  }
  const saved = { ...profile, id: userId, isLocalRegistered: true };
  store.upsertProfile(userId, userId, saved);
  return res.json({ profile: saved });
});

// Create or update one of your own studies.
app.put('/api/samples/:id', requireAuth, (req, res) => {
  const id = asId(req.params.id);
  if (!id || !isObject(req.body)) return res.status(400).json({ error: 'Pedido inválido.' });
  const userId: string = res.locals.userId;
  const { exists, ownerId } = store.sampleOwner(id);
  if (exists && ownerId !== userId) {
    return res.status(403).json({ error: 'Só o autor pode alterar este estudo.' });
  }
  // Comments and validation status are managed by the server, never by the author.
  const { peerComments: _comments, status, ...data } = req.body;
  const record = { ...data, id, collaboratorId: userId, status: status === 'draft' ? 'draft' : 'under_review' };
  store.upsertSample(id, userId, record);
  const saved = store.getSample(id)!;
  return res.json({ sample: { ...saved, status: derivedStatus(saved) } });
});

app.delete('/api/samples/:id', requireAuth, (req, res) => {
  const id = asId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Pedido inválido.' });
  const { exists, ownerId } = store.sampleOwner(id);
  if (!exists) return res.status(404).json({ error: 'Estudo não encontrado.' });
  if (ownerId !== res.locals.userId) return res.status(403).json({ error: 'Só o autor pode apagar este estudo.' });
  store.deleteSample(id);
  return res.json({ ok: true });
});

// Peer review comment / endorsement, with the rules enforced here.
app.post('/api/samples/:id/comments', requireAuth, (req, res) => {
  const id = asId(req.params.id);
  const { content, endorse, author, role, institution } = req.body || {};
  if (!id || typeof content !== 'string' || !content.trim()) return res.status(400).json({ error: 'Comentário vazio.' });
  const userId: string = res.locals.userId;
  const sample = store.getSample(id);
  if (!sample) return res.status(404).json({ error: 'Estudo não encontrado ou ainda só local.' });

  const mayEndorse = Boolean(endorse) && sample.collaboratorId !== userId && !store.hasEndorsed(id, userId);
  const createdAt = new Date().toISOString();
  const comment = {
    id: `c-${crypto.randomUUID()}`,
    sampleId: id,
    author: String(author || 'Pesquisador').slice(0, 200),
    authorId: userId,
    role: String(role || '').slice(0, 200),
    institution: String(institution || '').slice(0, 200),
    timestamp: `${createdAt.slice(0, 16).replace('T', ' ')} UTC`,
    content: content.trim().slice(0, 5000),
    statusChange: mayEndorse ? 'approved' : undefined,
  };
  store.insertComment(comment.id, id, userId, mayEndorse, comment, createdAt);
  const updated = store.getSample(id)!;
  return res.status(201).json({ sample: { ...updated, status: derivedStatus(updated) } });
});

// Message in a study's discussion (the sender comes from the session).
app.post('/api/samples/:id/messages', requireAuth, (req, res) => {
  const sampleId = asId(req.params.id);
  if (!sampleId || !isObject(req.body) || typeof req.body.content !== 'string' || !req.body.content.trim()) {
    return res.status(400).json({ error: 'Mensagem vazia.' });
  }
  const sentAt = new Date().toISOString();
  const message = {
    ...req.body,
    id: asId(req.body.id) || `st-${crypto.randomUUID()}`,
    sender: 'user',
    senderId: res.locals.userId,
    sentAt,
    content: req.body.content.trim().slice(0, 5000),
  };
  store.insertStudyMessage(message.id, sampleId, res.locals.userId, message, sentAt);
  return res.status(201).json({ message });
});

app.post('/api/groups', requireAuth, (req, res) => {
  const { title, objective, targetPlanet, memberIds } = req.body || {};
  if (typeof title !== 'string' || !title.trim() || typeof objective !== 'string') {
    return res.status(400).json({ error: 'Indique o nome e o objetivo do grupo.' });
  }
  const userId: string = res.locals.userId;
  const id = asId(req.body.id) || `net-${crypto.randomUUID()}`;
  if (store.groupExists(id)) return res.status(409).json({ error: 'Este grupo já existe.' });
  const data = {
    id,
    title: title.trim().slice(0, 200),
    objective: objective.trim().slice(0, 2000),
    targetPlanet: typeof targetPlanet === 'string' ? targetPlanet : 'Mars',
    createdAt: new Date().toISOString().slice(0, 10),
  };
  // The creator joins; other people are added as members they can leave at any time.
  const members = [userId, ...(Array.isArray(memberIds) ? memberIds.map(asId).filter(Boolean) : [])] as string[];
  store.insertGroup(id, userId, data, [...new Set(members)]);
  return res.status(201).json({ group: store.listGroups().find((g) => g.id === id) });
});

app.post('/api/groups/:id/membership', requireAuth, (req, res) => {
  const id = asId(req.params.id);
  if (!id || !store.groupExists(id)) return res.status(404).json({ error: 'Grupo não encontrado.' });
  const joined = store.toggleMembership(id, res.locals.userId);
  return res.json({ joined, group: store.listGroups().find((g) => g.id === id) });
});

// Production vs Development Setup
async function startServer() {
  // `npm start` passes --production (works on Windows too, unlike NODE_ENV=... prefixes).
  const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      plugins: [
        {
          name: 'disable-hmr-client-ws',
          enforce: 'post',
          transform(code, id) {
            if (
              id.includes('vite/dist/client/client.mjs') ||
              id.endsWith('/@vite/client')
            ) {
              return {
                code: code.replace(
                  'transport.connect(createHMRHandler(handleMessage));',
                  '/* HMR WebSocket disabled in middlewareMode */',
                ),
                map: null,
              };
            }
          },
        },
      ],
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GeoPlanetary Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
