import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '25mb' }));

// Hardcoded Official Geospatial & Planetary Scientific API Endpoints
const HARDCODED_OFFICIAL_APIS = {
  OPENTOPODATA_SRTM90M: 'https://api.opentopodata.org/v1/srtm90m',
  NASA_EONET_V3: 'https://eonet.gsfc.nasa.gov/api/v3/events?limit=10&status=open',
  NASA_GIBS_WMTS:
    'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2024-06-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
  OPENTOPOMAP_DEM: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  USGS_EARTHQUAKE_API:
    'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=8&minmagnitude=4.5',
} as const;

const LOCAL_DB_DIR = path.resolve(__dirname, '.local-data');
const LOCAL_DB_FILE = path.join(LOCAL_DB_DIR, 'african-analogs-db.json');

function readLocalDb(): Record<string, any> {
  try {
    if (fs.existsSync(LOCAL_DB_FILE)) {
      return JSON.parse(fs.readFileSync(LOCAL_DB_FILE, 'utf-8'));
    }
  } catch {
    // fallback empty store
  }
  return {};
}

function writeLocalDb(patch: Record<string, any>): void {
  try {
    if (!fs.existsSync(LOCAL_DB_DIR)) {
      fs.mkdirSync(LOCAL_DB_DIR, { recursive: true });
    }
    const current = readLocalDb();
    const merged = { ...current, ...patch, updatedAt: new Date().toISOString() };
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Local JSON persistence skipped:', err);
  }
}

// Server-side Gemini initialization
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Interactive AI Research Analyst (Prompt, Document/CSV & Optional Location)
app.post('/api/gemini/chat', async (req, res) => {
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

    if (!apiKey) {
      return res.status(500).json({
        error: 'Chave de API do Gemini não configurada no servidor. Verifique o painel Secrets.',
      });
    }

    const systemInstruction = `Você é o Analista Científico IA da plataforma colaborativa African Analogs (alinhado aos catálogos oficiais NASA PDS, OpenTopography SRTM DEM, USGS e ESA Europlanet).
Sua missão é auxiliar pesquisadores individuais e equipes a realizar investigações iniciais e validar lugares análogos na Terra (especialmente no continente africano e referências globais da NASA) para Marte, Lua, Europa, Encélado, Titã e Vênus — mesmo quando não há câmera ou imagem de visão computacional disponível, analisando diretamente descrições textuais, documentos técnicos e arquivos CSV/JSON de campo.

Conhecimento de referência:
1. Sítios Análogos Africanos & Globais: Depressão de Danakil & Dallol (Etiópia - Marte/Vênus hidrotermal hiperácido), Estrutura de Richat (Mauritânia - calibração orbital/Marte), Mar de Areia do Namibe (Namíbia - dunas lineares de Titã/Marte), Domo de Impacto de Vredefort (África do Sul - brechas e quartzo chocado da Lua), Lago Natron (Tanzânia - lagos alcalinos carbonatados de Encélado), Deserto do Atacama (Chile), Lanzarote (Espanha), Borup Fiord Pass (Ártico - Europa).
2. Análise de Documentos & CSV: Extraia padrões geoquímicos (aw, pH, óxidos XRF, minerais XRD), avalie limitações de habitabilidade/astrobiologia e estime o índice de fidelidade análoga (AFI).
3. Localização Opcional: Se o usuário fornecer coordenadas GPS ou sítio geográfico, relacione relevo, litologia regional e contexto topográfico DEM; se não fornecer, realize a análise estritamente pelos parâmetros textuais ou tabulares enviados.

Diretrizes de resposta:
- Responda em Português com rigor científico, objetividade e clareza estruturada (tópicos curtos, análogo terrestre mais próximo, corpo planetário compatível, métricas estimadas e recomendações práticas de validação).
- Evite tom informal ou saudações genéricas de chatbot.`;

    let contextPrompt = '';
    if (siteContext) {
      contextPrompt += `\n[SÍTIO DE REFERÊNCIA NO MAPA: ${siteContext.name} (${siteContext.country || ''}) | Alvo: ${siteContext.targetPlanet} | AFI: ${siteContext.fidelityScore}%]\n`;
    }
    if (useLocation && coordinates && (coordinates.lat !== undefined || Array.isArray(coordinates))) {
      const lat = Array.isArray(coordinates) ? coordinates[0] : coordinates.lat;
      const lng = Array.isArray(coordinates) ? coordinates[1] : coordinates.lng;
      contextPrompt += `\n[LOCALIZAÇÃO EM TEMPO REAL FORNECIDA: Latitude ${lat}°, Longitude ${lng}°]\n`;
    }
    if (activeSample) {
      contextPrompt += `\n[AMOSTRA ATIVA: "${activeSample.name}" | Minerais: ${JSON.stringify(activeSample.minerals)} | aw: ${activeSample.waterActivity} | pH: ${activeSample.pH}]\n`;
    }
    if (documentContent) {
      const trimmedDoc = String(documentContent).slice(0, 12000);
      contextPrompt += `\n[CONTEÚDO DO DOCUMENTO / CSV ANEXADO (${documentName || 'arquivo_pesquisa'})]:\n\`\`\`\n${trimmedDoc}\n\`\`\`\n`;
    }

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    if (contextPrompt) {
      contents.push({
        role: 'user',
        parts: [{ text: `Contexto técnico desta sessão de pesquisa:\n${contextPrompt}` }],
      });
      contents.push({
        role: 'model',
        parts: [{ text: 'Contexto e dados carregados. Pronto para analisar os parâmetros e documentos.' }],
      });
    }

    if (Array.isArray(messages) && messages.length > 0) {
      for (const msg of messages) {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }],
        });
      }
    }

    if (prompt && (!Array.isArray(messages) || messages.length === 0)) {
      contents.push({
        role: 'user',
        parts: [
          {
            text: `Corpo planetário de interesse inicial: ${targetPlanet}.\nSolicitação do pesquisador: ${prompt}`,
          },
        ],
      });
    } else if (documentContent && contents.length <= 2) {
      contents.push({
        role: 'user',
        parts: [
          {
            text: `Analise o documento/CSV anexado acima para o corpo planetário ${targetPlanet}, identifique o sítio análogo terrestre mais compatível e apresente um parecer técnico inicial.`,
          },
        ],
      });
    }

    if (contents.length === 0) {
      return res.status(400).json({
        error: 'Forneça um prompt de pesquisa ou anexe um documento/CSV para iniciar a análise.',
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: contents as any,
      config: {
        systemInstruction,
      },
    });

    return res.json({ reply: response.text });
  } catch (error: any) {
    console.error('Erro na rota /api/gemini/chat:', error);
    return res.status(500).json({
      error: error.message || 'Falha ao processar solicitação com o analista planetário.',
    });
  }
});

// Computer Vision & Real-time Location Analysis for Planetary Geology (PNG/JPEG/TIFF/Encrypted Decoded)
app.post('/api/gemini/vision-analyze', async (req, res) => {
  try {
    const {
      imageBase64,
      mimeType = 'image/jpeg',
      coordinates,
      targetPlanet = 'Mars',
      rasterMetadata,
    } = req.body;

    if (!apiKey) {
      return res.status(500).json({ error: 'Chave de API do Gemini não configurada.' });
    }

    if (!imageBase64) {
      return res.status(400).json({ error: 'Nenhuma imagem fornecida para análise de visão computacional.' });
    }

    const dataUriMatch = String(imageBase64).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    const resolvedMimeType = dataUriMatch ? dataUriMatch[1] : mimeType;
    const cleanBase64 = dataUriMatch
      ? dataUriMatch[2]
      : String(imageBase64).replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');

    const targetLabelMap: Record<string, string> = {
      Mars: 'MARTE',
      Moon: 'LUA',
      Europa: 'EUROPA (JÚPITER)',
      Enceladus: 'ENCÉLADO (SATURNO)',
      Titan: 'TITÃ (SATURNO)',
      Venus: 'VÊNUS',
      Both: 'MARTE e LUA',
    };
    const targetLabel = targetLabelMap[targetPlanet] || 'MARTE';

    const rasterContext = rasterMetadata
      ? `\n[METADADOS DO RASTER / TIFF / DESCRIPTOGRAFIA]: Formato: ${rasterMetadata.detectedFormat || 'Raster'} | Arquivo: ${rasterMetadata.originalFileName || 'campo'} | Dimensões: ${rasterMetadata.width || '?'}x${rasterMetadata.height || '?'} px | Bandas: ${rasterMetadata.bands || 1} (${rasterMetadata.bitsPerSample || 8}-bit) | Min/Média/Máx: ${rasterMetadata.minVal ?? '-'} / ${rasterMetadata.meanVal ?? '-'} / ${rasterMetadata.maxVal ?? '-'}${rasterMetadata.wasEncrypted ? ` | Descriptografado via: ${rasterMetadata.decryptionMethod}` : ''}\n`
      : '';

    const promptText = `Você é o sistema avançado de Visão Computacional Geológica e Reconhecimento de Terrenos Planetários da plataforma African Analogs (alinhado aos catálogos NASA PDS e ESA Europlanet).
Analise detalhadamente esta imagem de terreno, rocha, DEM GeoTIFF ou superfície capturada ${coordinates ? `nas coordenadas em tempo real [Lat: ${coordinates.lat}, Lng: ${coordinates.lng}]` : 'em campo'}.${rasterContext}

Avalie se este terreno/rocha possui feições análogas às de ${targetLabel}.

Responda em formato estruturado no seguinte formato textual claro em português:
[CORPO_ANALOGO_PROVAVEL]: (Mars, Moon, Europa, Enceladus, Titan ou Venus)
[ESCORE_FIDELIDADE]: (um número de 0 a 100)
[ANALOGO_TERRESTRE_MAIS_PROXIMO]: (ex: Depressão de Danakil & Dallol, Estrutura de Richat, Mar de Areia do Namibe, Domo de Impacto de Vredefort, Lago Natron, Deserto do Atacama, Geopark de Lanzarote ou Borup Fiord Pass)
[FEICOES_GEOLOGICAS_IDENTIFICADAS]: (liste 4 a 6 feições visuais, ex: crosta evaporítica, dunas lineares, brecha de impacto, basalto vesicular, óxidos de ferro, regolito fragmentado)
[MINERAIS_DETECTADOS_VISAO]: (liste minerais prováveis deduzidos pela cor, textura e albedo)
[ADEQUACAO_INSTRUMENTAL]: (quais instrumentos espaciais se beneficiam de testes aqui, ex: Mastcam-Z, PIXL, SuperCam, SHERLOC, LROC, Cassini Radar, MISE)
[DIAGNOSTICO_CIENTIFICO]: (parecer técnico sintetizado, sem enrolação, com rigor geológico)`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: resolvedMimeType,
              data: cleanBase64,
            },
          },
          {
            text: promptText,
          },
        ],
      },
      config: {
        systemInstruction: 'Você é um especialista em visão computacional e geomorfologia comparada planetária da NASA/ESA. Responda em português técnico e objetivo.',
      },
    });

    const reply = response.text || '';

    // Extract structured sections
    const extract = (tag: string, defaultVal: string) => {
      const regex = new RegExp(`\\[${tag}\\]:\\s*(.+?)(?=\\n\\[|$)`, 's');
      const match = reply.match(regex);
      return match ? match[1].trim() : defaultVal;
    };

    const planetaryMatch = extract('CORPO_ANALOGO_PROVAVEL', targetPlanet);
    const scoreStr = extract('ESCORE_FIDELIDADE', '88');
    const fidelityScore = parseInt(scoreStr.replace(/\D/g, ''), 10) || 88;
    const closestAnalogue = extract('ANALOGO_TERRESTRE_MAIS_PROXIMO', 'Depressão de Danakil & Dallol');
    const featuresRaw = extract('FEICOES_GEOLOGICAS_IDENTIFICADAS', 'Textura de regolito, fraturamento mecânico, albedo uniforme');
    const mineralsRaw = extract('MINERAIS_DETECTADOS_VISAO', 'Silicatos, óxidos de ferro');
    const instruments = extract('ADEQUACAO_INSTRUMENTAL', 'Mastcam-Z, ChemCam, SuperCam');
    const diagnosis = extract('DIAGNOSTICO_CIENTIFICO', reply);

    return res.json({
      success: true,
      rawText: reply,
      planetaryMatch,
      fidelityScore: Math.min(99, Math.max(30, fidelityScore)),
      closestAnalogue,
      features: featuresRaw.split(/[,;\n•-]/).map((s) => s.trim()).filter((s) => s.length > 2),
      minerals: mineralsRaw.split(/[,;\n•-]/).map((s) => s.trim()).filter((s) => s.length > 2),
      instruments,
      diagnosis,
    });
  } catch (error: any) {
    console.error('Erro na visão computacional:', error);
    return res.status(500).json({
      error: error.message || 'Falha ao processar visão computacional com IA.',
    });
  }
});

// Menu-driven Scientific Diagnostics Pathway
app.post('/api/gemini/diagnostics', async (req, res) => {
  try {
    const { action, sample, site, targetPlanet, coordinates } = req.body;

    if (!apiKey) {
      return res.status(500).json({ error: 'Chave de API do Gemini não configurada.' });
    }

    const actionPrompts: Record<string, string> = {
      mars_jezero_match: `Avalie a compatibilidade da amostra "${sample?.name || 'Amostra de Campo'}" (${site?.name || 'Sítio'}) com os estratos sedimentares do delta e cratera de Jezero (Marte). Analise minerais presentes: ${JSON.stringify(sample?.minerals || {})}, aw: ${sample?.waterActivity}, pH: ${sample?.pH}.`,
      moon_shackleton_match: `Avalie a equivalência da amostra "${sample?.name || 'Amostra'}" com o regolito da Bacia Polo Sul-Aitken e Cratera Shackleton (Lua), focando em anortosito, piroxênio, ilmenita, pseudotaquilito e voláteis criogênicos protegidos em regiões permanentemente sombreadas (PSRs).`,
      europa_ice_brine_match: `Avalie a correspondência da amostra com a crosta de gelo e surgências de salmoura rica em sulfatos hidratados de Europa (Júpiter) visando o espectrômetro MISE da sonda Europa Clipper da NASA.`,
      enceladus_serpentine_plume: `Avalie o potencial da amostra como análogo para o oceano hidrotermal de Encélado (Saturno), com foco em serpentinização abiótica, carbonatos de sódio (trona/natrão), pH hiperalcalino (9-11) e geração de H2 e CH4 molecular detectados pela sonda Cassini.`,
      titan_hydrocarbon_dune: `Avalie a analogia da amostra e morfologia do sítio ${site?.name || ''} com as dunas orgânicas de tolina e lagos de hidrocarbonetos líquidos de Titã (Saturno) para a missão Dragonfly da NASA.`,
      venus_supercritical_volcano: `Avalie a resistência e equivalência mineralógica com as planícies vulcânicas basálticas sob atmosfera supercrítica densa e corrosiva de Vênus (sondas VERITAS e DAVINCI da NASA).`,
      rover_instrument_simulation: `Simule um ensaio operacional com instrumentos de rover (SuperCam LIBS/Raman, PIXL fluorescência elementar, SHERLOC UV) na amostra "${sample?.name || ''}". Quais bioassinaturas ou traços elementares seriam detectados?`,
      extremophile_biosignature: `Analise a viabilidade biológica e preservação de bioassinaturas considerando a atividade de água aw=${sample?.waterActivity || 0.3}, pH=${sample?.pH || 7} e o regime de radiação do sítio análogo ${site?.name || ''}.`,
      isru_resource_detection: `Analise a viabilidade de Utilização de Recursos In Situ (ISRU) na amostra "${sample?.name || ''}" — extração de água molecular a partir de sulfatos/argilas ou oxigênio a partir de óxidos de ferro/ilmenita.`,
    };

    const chosenPrompt = actionPrompts[action] || `Realize um diagnóstico analítico da amostra ${sample?.name || 'geológica'} (${targetPlanet || 'Mars'}, coordenadas ${JSON.stringify(coordinates || [])}).`;

    const systemInstruction = `Você é o relator técnico da plataforma African Analogs. Forneça diagnósticos objetivos e numéricos, sem estilo de chatbot amigável.
Estruture a resposta com:
1. Resumo Executivo (2 linhas)
2. Score de Correspondência (0-100%)
3. Pontos Críticos de Validação
4. Recomendação Direta para o Relatório Oficial.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: chosenPrompt,
      config: {
        systemInstruction,
      },
    });

    return res.json({ result: response.text });
  } catch (error: any) {
    console.error('Erro na rota de diagnósticos:', error);
    return res.status(500).json({
      error: error.message || 'Falha ao executar diagnóstico.',
    });
  }
});

// Formal Planetary Analogue Technical Report Generator (LPSC / NASA Protocol)
app.post('/api/gemini/generate-report', async (req, res) => {
  try {
    const { sample, site, visionData, attachedDiagnostics, targetPlanet, investigator } = req.body;

    if (!apiKey) {
      return res.status(500).json({ error: 'Chave de API do Gemini não configurada.' });
    }

    const reportPrompt = `Gere um Relatório Técnico de Certificação de Sítio Análogo Planetário (Planetary Analogue Technical Report) da plataforma African Analogs no padrão formal de missões espaciais (formato Lunar and Planetary Science Conference / COSPAR):
Investigador: ${investigator || 'Pesquisador Responsável'}
Alvo Planetário: ${targetPlanet || 'Mars'}
Sítio Análogo: ${site?.name || 'Localização de Amostragem'} (${site?.country || ''} · ${site?.location || 'Coordenadas em tempo real'})
Fonte Oficial de Referência: ${sample?.officialSource || site?.dataSource || 'NASA PDS / SRTM DEM'}
Amostra: ${sample?.name || 'Amostra de Regolito'}
Classificação da Rocha: ${sample?.rockClassification || 'Regolito Vulcânico / Evaporítico'}
Parâmetros Físico-Químicos: aw=${sample?.waterActivity}, pH=${sample?.pH}, Profundidade=${sample?.depthCm}cm
Composição XRD/Mineral: ${JSON.stringify(sample?.minerals || {})}
Composição XRF: ${JSON.stringify(sample?.xrfComposition || {})}
${visionData ? `Dados de Visão Computacional: ${JSON.stringify(visionData)}` : ''}
${attachedDiagnostics ? `Parecer Diagnóstico Anexado: ${attachedDiagnostics}` : ''}

Estrutura formal obrigatória:
# CERTIFICADO DE FIDELIDADE ANÁLOGA PLANETÁRIA — AFRICAN ANALOGS
## 1. RESUMO EXECUTIVO E IDENTIFICAÇÃO DE MISSÃO
## 2. PARECER GEOMORFOLÓGICO & VISÃO COMPUTACIONAL
## 3. EQUIVALÊNCIA MINERALÓGICA & GEOQUÍMICA COMPARATIVA
## 4. ANÁLISE DE ESTRESSE AMBIENTAL & BIOASSINATURAS (ASTROBIOLOGIA)
## 5. RECOMENDAÇÃO DE INSTRUMENTAÇÃO ESPACIAL DE CAMPO
## 6. CONCLUSÃO & ÍNDICE FINAL DE FIDELIDADE (AFI)

Use linguagem científica precisa em português, com termos formais (petrologia, espectrometria, albedo, habitabilidade).`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: reportPrompt,
      config: {
        systemInstruction: 'Você é um relator oficial do Planetary Science Division da NASA e ESA vinculado à plataforma African Analogs. Redija documentos técnicos completos e com rigor científico absoluto.',
      },
    });

    return res.json({ report: response.text });
  } catch (error: any) {
    console.error('Erro na geração de relatório:', error);
    return res.status(500).json({
      error: error.message || 'Falha ao emitir relatório.',
    });
  }
});

// Hardcoded Official API Catalog, SRTM DEM Elevation & NASA EONET Live Events
app.get('/api/official/catalog', (_req, res) => {
  return res.json({
    endpoints: HARDCODED_OFFICIAL_APIS,
    aiConfigured: Boolean(apiKey),
    storageMode: 'local-persistent',
  });
});

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

app.get('/api/official/nasa-events', async (_req, res) => {
  try {
    const apiRes = await fetch(HARDCODED_OFFICIAL_APIS.NASA_EONET_V3, {
      signal: AbortSignal.timeout(5000),
    });
    if (!apiRes.ok) {
      return res.json({ events: [], source: HARDCODED_OFFICIAL_APIS.NASA_EONET_V3 });
    }
    const data: any = await apiRes.json();
    const events = (data?.events || []).slice(0, 8).map((ev: any) => {
      const geo = ev.geometry?.[0];
      const coords = Array.isArray(geo?.coordinates) && geo.coordinates.length >= 2
        ? ([Number(geo.coordinates[1]), Number(geo.coordinates[0])] as [number, number])
        : undefined;
      return {
        id: ev.id,
        title: ev.title,
        category: ev.categories?.[0]?.title || 'Evento Natural',
        date: geo?.date ? String(geo.date).slice(0, 10) : '',
        coordinates: coords,
      };
    });
    return res.json({ events, source: HARDCODED_OFFICIAL_APIS.NASA_EONET_V3 });
  } catch {
    return res.json({ events: [], source: HARDCODED_OFFICIAL_APIS.NASA_EONET_V3 });
  }
});

// Local-First Persistent JSON Storage for Accounts, Dynamic Profiles & Studies
app.get('/api/local/state', (_req, res) => {
  return res.json(readLocalDb());
});

app.post('/api/local/state', (req, res) => {
  if (req.body && typeof req.body === 'object') {
    writeLocalDb(req.body);
  }
  return res.json({ ok: true });
});

// Production vs Development Setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
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
