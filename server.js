import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
app.use(express.json({ limit: "25mb" }));
const HARDCODED_OFFICIAL_APIS = {
  OPENTOPODATA_SRTM90M: "https://api.opentopodata.org/v1/srtm90m",
  NASA_EONET_V3: "https://eonet.gsfc.nasa.gov/api/v3/events?limit=10&status=open",
  NASA_GIBS_WMTS: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2024-06-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg",
  OPENTOPOMAP_DEM: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
  USGS_EARTHQUAKE_API: "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=8&minmagnitude=4.5"
};
const LOCAL_DB_DIR = path.resolve(__dirname, ".local-data");
const LOCAL_DB_FILE = path.join(LOCAL_DB_DIR, "african-analogs-db.json");
function readLocalDb() {
  try {
    if (fs.existsSync(LOCAL_DB_FILE)) {
      return JSON.parse(fs.readFileSync(LOCAL_DB_FILE, "utf-8"));
    }
  } catch {
  }
  return {};
}
function writeLocalDb(patch) {
  try {
    if (!fs.existsSync(LOCAL_DB_DIR)) {
      fs.mkdirSync(LOCAL_DB_DIR, { recursive: true });
    }
    const current = readLocalDb();
    const merged = { ...current, ...patch, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(merged, null, 2), "utf-8");
  } catch (err) {
    console.warn("Local JSON persistence skipped:", err);
  }
}
const NVIDIA_API_KEY = "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";
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const NVIDIA_MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b";
const openai = new OpenAI({
  apiKey: NVIDIA_API_KEY,
  baseURL: NVIDIA_BASE_URL
});
async function runNemotronCompletion(messages) {
  const completion = await openai.chat.completions.create({
    model: NVIDIA_MODEL,
    messages,
    temperature: 1,
    top_p: 0.95,
    max_tokens: 16384,
    reasoning_budget: 16384,
    chat_template_kwargs: { enable_thinking: true },
    stream: true
  });
  let reasoning = "";
  let content = "";
  for await (const chunk of completion) {
    const delta = chunk.choices?.[0]?.delta;
    if (delta?.reasoning_content) {
      reasoning += delta.reasoning_content;
    }
    if (delta?.content) {
      content += delta.content;
    }
  }
  return {
    content: content.trim(),
    reasoning: reasoning.trim()
  };
}
app.post(["/api/gemini/chat", "/api/ai/chat"], async (req, res) => {
  try {
    const {
      messages = [],
      prompt,
      documentContent,
      documentName,
      targetPlanet = "Mars",
      coordinates,
      useLocation = false,
      siteContext,
      activeSample
    } = req.body;
    const systemInstruction = `Voc\xEA \xE9 o Copiloto Analista Cient\xEDfico da plataforma colaborativa African Analogs (alinhado aos cat\xE1logos oficiais NASA PDS, OpenTopography SRTM DEM, USGS e ESA Europlanet).
Sua miss\xE3o \xE9 atuar como copiloto de an\xE1lise para ajudar pesquisadores e estudantes a interpretar dados inseridos manualmente sobre lugares an\xE1logos na Terra (especialmente na \xC1frica e refer\xEAncias globais da NASA) para Marte, Lua, Europa, Enc\xE9lado, Tit\xE3 e V\xEAnus.

Conhecimento de refer\xEAncia:
1. S\xEDtios An\xE1logos Africanos & Globais: Depress\xE3o de Danakil & Dallol (Eti\xF3pia - Marte/V\xEAnus hidrotermal hiper\xE1cido), Estrutura de Richat (Maurit\xE2nia - calibra\xE7\xE3o orbital/Marte), Mar de Areia do Namibe (Nam\xEDbia - dunas lineares de Tit\xE3/Marte), Domo de Impacto de Vredefort (\xC1frica do Sul - brechas e quartzo chocado da Lua), Lago Natron (Tanz\xE2nia - lagos alcalinos carbonatados de Enc\xE9lado), Deserto do Atacama (Chile), Lanzarote (Espanha), Borup Fiord Pass (\xC1rtico - Europa).
2. An\xE1lise de Documentos & CSV: Extraia padr\xF5es geoqu\xEDmicos (aw, pH, \xF3xidos XRF, minerais XRD), avalie limita\xE7\xF5es de habitabilidade/astrobiologia e comente o \xEDndice de semelhan\xE7a/fidelidade an\xE1loga (AFI).
3. Localiza\xE7\xE3o Opcional: Se o usu\xE1rio fornecer coordenadas GPS ou s\xEDtio geogr\xE1fico, relacione relevo, litologia regional e contexto topogr\xE1fico DEM; caso contr\xE1rio, analise estritamente pelos par\xE2metros manuais e documentos enviados.

Diretrizes de resposta:
- Responda em Portugu\xEAs claro, estruturado e acess\xEDvel (t\xF3picos curtos, an\xE1logo terrestre mais pr\xF3ximo, pontos fortes, limites e recomenda\xE7\xF5es pr\xE1ticas).
- N\xE3o invente medi\xE7\xF5es que o pesquisador n\xE3o forneceu; ajude-o a interpretar os dados manuais.`;
    let contextPrompt = "";
    if (siteContext) {
      contextPrompt += `
[S\xCDTIO DE REFER\xCANCIA NO MAPA: ${siteContext.name} (${siteContext.country || ""}) | Alvo: ${siteContext.targetPlanet} | Semelhan\xE7a: ${siteContext.fidelityScore}%]
`;
    }
    if (useLocation && coordinates && (coordinates.lat !== void 0 || Array.isArray(coordinates))) {
      const lat = Array.isArray(coordinates) ? coordinates[0] : coordinates.lat;
      const lng = Array.isArray(coordinates) ? coordinates[1] : coordinates.lng;
      contextPrompt += `
[LOCALIZA\xC7\xC3O EM TEMPO REAL FORNECIDA: Latitude ${lat}\xB0, Longitude ${lng}\xB0]
`;
    }
    if (activeSample) {
      contextPrompt += `
[DADOS MANUAIS ATIVOS: "${activeSample.name}" | Lugar: ${activeSample.customLocation || siteContext?.name || "N\xE3o informado"} | Minerais: ${JSON.stringify(activeSample.minerals)} | Umidade (aw): ${activeSample.waterActivity} | pH: ${activeSample.pH}]
`;
    }
    if (documentContent) {
      const trimmedDoc = String(documentContent).slice(0, 12e3);
      contextPrompt += `
[CONTE\xDADO DO DOCUMENTO / CSV ANEXADO (${documentName || "arquivo_pesquisa"})]:
\`\`\`
${trimmedDoc}
\`\`\`
`;
    }
    const nemotronMessages = [
      { role: "system", content: systemInstruction }
    ];
    if (contextPrompt) {
      nemotronMessages.push({
        role: "user",
        content: `Contexto t\xE9cnico desta sess\xE3o de pesquisa:
${contextPrompt}`
      });
      nemotronMessages.push({
        role: "assistant",
        content: "Contexto e dados manuais carregados. Pronto para atuar como copiloto na an\xE1lise."
      });
    }
    if (Array.isArray(messages) && messages.length > 0) {
      for (const msg of messages) {
        nemotronMessages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: String(msg.content || "")
        });
      }
    } else if (prompt) {
      nemotronMessages.push({
        role: "user",
        content: `Corpo planet\xE1rio de interesse: ${targetPlanet}.
Solicita\xE7\xE3o do usu\xE1rio: ${prompt}`
      });
    } else if (documentContent) {
      nemotronMessages.push({
        role: "user",
        content: `Analise o documento/CSV anexado acima para o corpo planet\xE1rio ${targetPlanet}, identifique o s\xEDtio an\xE1logo terrestre mais compat\xEDvel e apresente um parecer t\xE9cnico claro.`
      });
    }
    if (nemotronMessages.length <= 1) {
      return res.status(400).json({
        error: "Forne\xE7a uma pergunta de pesquisa ou anexe um documento/CSV para iniciar a an\xE1lise."
      });
    }
    const { content, reasoning } = await runNemotronCompletion(nemotronMessages);
    return res.json({ reply: content, reasoning, model: NVIDIA_MODEL });
  } catch (error) {
    console.error("Erro na rota /api/gemini/chat:", error);
    return res.status(500).json({
      error: error.message || "Falha ao processar solicita\xE7\xE3o com a IA NVIDIA Nemotron."
    });
  }
});
app.post(["/api/gemini/vision-analyze", "/api/ai/vision-analyze"], async (req, res) => {
  try {
    const {
      imageBase64,
      coordinates,
      targetPlanet = "Mars",
      rasterMetadata,
      visualTelemetry,
      visualNotes
    } = req.body;
    if (!imageBase64 && !visualTelemetry && !rasterMetadata) {
      return res.status(400).json({ error: "Nenhuma imagem ou telemetria visual fornecida para an\xE1lise." });
    }
    const targetLabelMap = {
      Mercury: "MERC\xDARIO",
      Venus: "V\xCANUS",
      Earth: "TERRA (REFER\xCANCIA)",
      Mars: "MARTE",
      Jupiter: "J\xDAPITER",
      Saturn: "SATURNO",
      Uranus: "URANO",
      Neptune: "NETUNO",
      Ceres: "CERES (PLANETA AN\xC3O)",
      Pluto: "PLUT\xC3O (PLANETA AN\xC3O)",
      Moon: "LUA (TERRA)",
      Phobos: "FOBOS (MARTE)",
      Deimos: "DEIMOS (MARTE)",
      Io: "IO (J\xDAPITER)",
      Europa: "EUROPA (J\xDAPITER)",
      Ganymede: "GANIMEDES (J\xDAPITER)",
      Callisto: "CALISTO (J\xDAPITER)",
      Mimas: "MIMAS (SATURNO)",
      Enceladus: "ENC\xC9LADO (SATURNO)",
      Tethys: "T\xC9TIS (SATURNO)",
      Dione: "DIONE (SATURNO)",
      Rhea: "REIA (SATURNO)",
      Titan: "TIT\xC3 (SATURNO)",
      Iapetus: "J\xC1PETO (SATURNO)",
      Miranda: "MIRANDA (URANO)",
      Ariel: "ARIEL (URANO)",
      Umbriel: "UMBRIEL (URANO)",
      Titania: "TIT\xC2NIA (URANO)",
      Oberon: "OBERON (URANO)",
      Triton: "TRIT\xC3O (NETUNO)",
      Charon: "CARONTE (PLUT\xC3O)",
      Both: "MARTE e LUA"
    };
    const targetLabel = targetLabelMap[targetPlanet] || String(targetPlanet || "MARTE").toUpperCase();
    const rasterContext = rasterMetadata ? `
[METADADOS DO RASTER / TIFF / DESCRIPTOGRAFIA]: Formato: ${rasterMetadata.detectedFormat || "Raster"} | Arquivo: ${rasterMetadata.originalFileName || "campo"} | Dimens\xF5es: ${rasterMetadata.width || "?"}x${rasterMetadata.height || "?"} px | Bandas: ${rasterMetadata.bands || 1} (${rasterMetadata.bitsPerSample || 8}-bit) | Min/M\xE9dia/M\xE1x: ${rasterMetadata.minVal ?? "-"} / ${rasterMetadata.meanVal ?? "-"} / ${rasterMetadata.maxVal ?? "-"}${rasterMetadata.wasEncrypted ? ` | Descriptografado via: ${rasterMetadata.decryptionMethod}` : ""}
` : "";
    const telemetryContext = visualTelemetry ? `
[TELEMETRIA VISUAL MEDIDA DA IMAGEM]: Cor predominante: ${visualTelemetry.dominantColorTag || "Neutra"} | RGB m\xE9dio: (${visualTelemetry.meanRed ?? "-"}, ${visualTelemetry.meanGreen ?? "-"}, ${visualTelemetry.meanBlue ?? "-"}) | Albedo/Brilho estimado: ${visualTelemetry.brightnessAlbedo ?? "-"} | \xCDndice de \xD3xido de Ferro (R-B): ${visualTelemetry.ironOxideIndex ?? "-"} | Contraste/Rugosidade superficial: ${visualTelemetry.surfaceContrast ?? "-"} | Dimens\xF5es: ${visualTelemetry.width || "?"}x${visualTelemetry.height || "?"} px
` : "";
    const notesContext = visualNotes ? `
[OBSERVA\xC7\xC3O VISUAL DO USU\xC1RIO SOBRE A FOTO]: ${visualNotes}
` : "";
    const promptText = `Voc\xEA \xE9 o sistema de apoio \xE0 Vis\xE3o Geol\xF3gica e Reconhecimento de Terrenos Planet\xE1rios da plataforma African Analogs.
Analise os dados visuais extra\xEDdos desta imagem de terreno, rocha, DEM GeoTIFF ou superf\xEDcie capturada ${coordinates ? `nas coordenadas [Lat: ${coordinates.lat}, Lng: ${coordinates.lng}]` : "em campo"}.${rasterContext}${telemetryContext}${notesContext}

Avalie se este terreno/rocha possui caracter\xEDsticas an\xE1logas \xE0s de ${targetLabel}.

Responda obrigatoriamente neste formato textual exato em portugu\xEAs (N\xC3O coloque par\xEAnteses ao redor das respostas):
[CORPO_ANALOGO_PROVAVEL]: nome em ingl\xEAs do planeta ou sat\xE9lite natural mais compat\xEDvel (ex: Mercury, Venus, Mars, Moon, Phobos, Io, Europa, Ganymede, Callisto, Enceladus, Titan, Triton, Ceres, Pluto, etc.)
[ESCORE_FIDELIDADE]: n\xFAmero inteiro de 0 a 100
[ANALOGO_TERRESTRE_MAIS_PROXIMO]: ex: Depress\xE3o de Danakil & Dallol, Estrutura de Richat, Mar de Areia do Namibe, Domo de Impacto de Vredefort, Lago Natron, Deserto do Atacama, Geopark de Lanzarote ou Borup Fiord Pass
[FEICOES_GEOLOGICAS_IDENTIFICADAS]: 4 a 6 fei\xE7\xF5es visuais separadas por ponto e v\xEDrgula
[MINERAIS_DETECTADOS_VISAO]: 2 a 4 minerais prov\xE1veis separados por v\xEDrgula
[ADEQUACAO_INSTRUMENTAL]: instrumentos espaciais separados por v\xEDrgula
[DIAGNOSTICO_CIENTIFICO]: parecer claro em 3 a 5 linhas, sem enrola\xE7\xE3o`;
    const { content: reply, reasoning } = await runNemotronCompletion([
      {
        role: "system",
        content: "Voc\xEA \xE9 um especialista em geomorfologia comparada planet\xE1ria da NASA/ESA atuando como copiloto visual. Responda em portugu\xEAs claro, rigoroso e no formato de tags solicitado sem usar par\xEAnteses em volta dos valores."
      },
      { role: "user", content: promptText }
    ]);
    const cleanOuterParens = (val) => val.replace(/^\(([\s\S]*)\)$/, "$1").trim();
    const extract = (tag, defaultVal) => {
      const regex = new RegExp(`\\[${tag}\\]:\\s*(.+?)(?=\\n\\[|$)`, "s");
      const match = reply.match(regex);
      return match ? cleanOuterParens(match[1].trim()) : defaultVal;
    };
    const planetaryMatch = extract("CORPO_ANALOGO_PROVAVEL", targetPlanet);
    const scoreStr = extract("ESCORE_FIDELIDADE", "82");
    const fidelityScore = parseInt(scoreStr.replace(/\D/g, ""), 10) || 82;
    const closestAnalogue = extract("ANALOGO_TERRESTRE_MAIS_PROXIMO", "Depress\xE3o de Danakil & Dallol");
    const featuresRaw = extract("FEICOES_GEOLOGICAS_IDENTIFICADAS", "Textura de regolito; contraste superficial; albedo moderado");
    const mineralsRaw = extract("MINERAIS_DETECTADOS_VISAO", "Silicatos, \xD3xidos de Ferro");
    const instruments = extract("ADEQUACAO_INSTRUMENTAL", "Mastcam-Z, ChemCam, SuperCam");
    const diagnosis = extract("DIAGNOSTICO_CIENTIFICO", reply);
    const featureDelimiter = featuresRaw.includes(";") ? /[;\n•]+/ : /[,;\n•]+(?![^()]*\))/;
    return res.json({
      success: true,
      rawText: reply,
      reasoning,
      model: NVIDIA_MODEL,
      planetaryMatch,
      fidelityScore: Math.min(99, Math.max(30, fidelityScore)),
      closestAnalogue,
      features: featuresRaw.split(featureDelimiter).map((s) => cleanOuterParens(s.trim())).filter((s) => s.length > 2),
      minerals: mineralsRaw.split(/[,;\n•]+/).map((s) => cleanOuterParens(s.trim())).filter((s) => s.length > 2),
      instruments,
      diagnosis
    });
  } catch (error) {
    console.error("Erro na vis\xE3o computacional:", error);
    return res.status(500).json({
      error: error.message || "Falha ao processar an\xE1lise visual com NVIDIA Nemotron."
    });
  }
});
app.post(["/api/gemini/diagnostics", "/api/ai/diagnostics"], async (req, res) => {
  try {
    const { action, sample, site, targetPlanet, coordinates } = req.body;
    const actionPrompts = {
      selected_target_match: `Avalie a compatibilidade da amostra "${sample?.name || "Amostra de Campo"}" (${sample?.customLocation || site?.name || "S\xEDtio"}) como an\xE1logo terrestre para o corpo planet\xE1rio/sat\xE9lite natural "${targetPlanet || "Mars"}". Analise minerais: ${JSON.stringify(sample?.minerals || {})}, umidade aw: ${sample?.waterActivity}, pH: ${sample?.pH}, limites e oportunidades de estudo.`,
      mars_jezero_match: `Avalie a compatibilidade da amostra "${sample?.name || "Amostra de Campo"}" (${sample?.customLocation || site?.name || "S\xEDtio"}) com os estratos sedimentares do delta e cratera de Jezero (Marte). Analise minerais presentes: ${JSON.stringify(sample?.minerals || {})}, aw: ${sample?.waterActivity}, pH: ${sample?.pH}.`,
      moon_shackleton_match: `Avalie a equival\xEAncia da amostra "${sample?.name || "Amostra"}" com o regolito da Bacia Polo Sul-Aitken e Cratera Shackleton (Lua), focando em anortosito, pirox\xEAnio, ilmenita, pseudotaquilito e vol\xE1teis criog\xEAnicos.`,
      europa_ice_brine_match: `Avalie a correspond\xEAncia da amostra com a crosta de gelo e surg\xEAncias de salmoura rica em sulfatos hidratados de Europa (J\xFApiter) visando o espectr\xF4metro MISE da sonda Europa Clipper.`,
      enceladus_serpentine_plume: `Avalie o potencial da amostra como an\xE1logo para o oceano hidrotermal de Enc\xE9lado (Saturno), com foco em serpentiniza\xE7\xE3o abi\xF3tica, carbonatos de s\xF3dio (trona/natr\xE3o) e pH hiperalcalino.`,
      titan_hydrocarbon_dune: `Avalie a analogia da amostra e morfologia do s\xEDtio ${sample?.customLocation || site?.name || ""} com as dunas org\xE2nicas e lagos de Tit\xE3 (Saturno) para a miss\xE3o Dragonfly.`,
      venus_supercritical_volcano: `Avalie a equival\xEAncia mineral\xF3gica com as plan\xEDcies vulc\xE2nicas bas\xE1lticas sob atmosfera densa de V\xEAnus (miss\xF5es VERITAS e DAVINCI).`,
      rover_instrument_simulation: `Simule o que instrumentos de rover espacial (SuperCam, PIXL, SHERLOC) detectariam na amostra manual "${sample?.name || ""}".`,
      extremophile_biosignature: `Analise a chance de \xE1gua, habitabilidade e preserva\xE7\xE3o de bioassinaturas considerando umidade aw=${sample?.waterActivity || 0.3}, pH=${sample?.pH || 7} no local ${sample?.customLocation || site?.name || ""}.`,
      isru_resource_detection: `Analise recursos \xFAteis no local (extra\xE7\xE3o de \xE1gua ou oxig\xEAnio a partir dos minerais) na amostra "${sample?.name || ""}".`
    };
    const chosenPrompt = actionPrompts[action] || `Realize um diagn\xF3stico anal\xEDtico da amostra ${sample?.name || "geol\xF3gica"} (${targetPlanet || "Mars"}, coordenadas ${JSON.stringify(coordinates || [])}).`;
    const systemInstruction = `Voc\xEA \xE9 o copiloto t\xE9cnico da plataforma African Analogs. Forne\xE7a diagn\xF3sticos claros, objetivos e \xFAteis em portugu\xEAs.
Estruture a resposta com:
1. Resumo Direto (2 linhas)
2. Avalia\xE7\xE3o dos Dados Manuais
3. Pontos Fortes e Pontos de Aten\xE7\xE3o
4. Recomenda\xE7\xE3o Pr\xE1tica para o Estudo.`;
    const { content, reasoning } = await runNemotronCompletion([
      { role: "system", content: systemInstruction },
      { role: "user", content: chosenPrompt }
    ]);
    return res.json({ result: content, reasoning, model: NVIDIA_MODEL });
  } catch (error) {
    console.error("Erro na rota de diagn\xF3sticos:", error);
    return res.status(500).json({
      error: error.message || "Falha ao executar diagn\xF3stico."
    });
  }
});
app.post(["/api/gemini/generate-report", "/api/ai/generate-report"], async (req, res) => {
  try {
    const { sample, site, visionData, attachedDiagnostics, targetPlanet, investigator } = req.body;
    const reportPrompt = `Gere um Resumo T\xE9cnico de Apoio para o estudo de lugar an\xE1logo planet\xE1rio na plataforma African Analogs:
Investigador / Autor: ${investigator || "Pesquisador Respons\xE1vel"}
Alvo Planet\xE1rio: ${targetPlanet || "Mars"}
Lugar Informado Manualmente: ${sample?.customLocation || site?.name || "Localiza\xE7\xE3o de Amostragem"} (${site?.country || ""})
Origem dos Dados: ${sample?.officialSource || site?.dataSource || "Registro Manual"}
Amostra: ${sample?.name || "Amostra de Campo"}
Tipo de Rocha/Solo: ${sample?.rockClassification || "Solo / Rocha Natural"}
Par\xE2metros Manuais: umidade aw=${sample?.waterActivity}, pH=${sample?.pH}, Profundidade=${sample?.depthCm}cm
Minerais Informados: ${JSON.stringify(sample?.minerals || {})}
Composi\xE7\xE3o Qu\xEDmica: ${JSON.stringify(sample?.xrfComposition || {})}
Notas do Autor: ${sample?.fieldNotes || ""}
${visionData ? `Observa\xE7\xF5es Visuais de Apoio: ${JSON.stringify(visionData)}` : ""}
${attachedDiagnostics ? `An\xE1lises Anteriores do Copiloto: ${attachedDiagnostics}` : ""}

Estrutura clara em portugu\xEAs:
# RESUMO DA PESQUISA \u2014 AFRICAN ANALOGS
## 1. VIS\xC3O GERAL E LOCAL ESTUDADO
## 2. INTERPRETA\xC7\xC3O DO SOLO, MINERAIS E UMIDADE
## 3. SEMELHAN\xC7AS COM ${String(targetPlanet || "MARTE").toUpperCase()} E LIMITES DO TESTE
## 4. RECOMENDA\xC7\xD5ES PR\xC1TICAS PARA CONTINUAR O ESTUDO
## 5. SUGEST\xC3O DE CONCLUS\xC3O PARA ARTIGO`;
    const { content, reasoning } = await runNemotronCompletion([
      {
        role: "system",
        content: "Voc\xEA \xE9 o copiloto editorial da plataforma African Analogs. Redija um resumo t\xE9cnico claro, organizado e fiel exclusivamente aos dados fornecidos pelo pesquisador."
      },
      { role: "user", content: reportPrompt }
    ]);
    return res.json({ report: content, reasoning, model: NVIDIA_MODEL });
  } catch (error) {
    console.error("Erro na gera\xE7\xE3o de relat\xF3rio:", error);
    return res.status(500).json({
      error: error.message || "Falha ao emitir resumo com o copiloto."
    });
  }
});
app.get("/api/official/catalog", (_req, res) => {
  return res.json({
    endpoints: HARDCODED_API_APIS_SAFE(),
    aiConfigured: true,
    aiModel: NVIDIA_MODEL,
    aiProvider: "NVIDIA NIM (Hardcoded)",
    storageMode: "local-persistent"
  });
});
function HARDCODED_API_APIS_SAFE() {
  return {
    ...HARDCODED_OFFICIAL_APIS,
    NVIDIA_NIM_BASE_URL: NVIDIA_BASE_URL,
    NVIDIA_NIM_MODEL: NVIDIA_MODEL
  };
}
app.get("/api/official/elevation", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: "Latitude e longitude inv\xE1lidas." });
  }
  try {
    const url = `${HARDCODED_OFFICIAL_APIS.OPENTOPODATA_SRTM90M}?locations=${lat},${lng}`;
    const apiRes = await fetch(url, { signal: AbortSignal.timeout(5e3) });
    if (!apiRes.ok) {
      return res.json({ elevationMeters: null, dataset: "srtm90m", source: "upstream-unavailable" });
    }
    const payload = await apiRes.json();
    const elevation = payload?.results?.[0]?.elevation;
    return res.json({
      elevationMeters: typeof elevation === "number" ? Math.round(elevation) : null,
      dataset: "NASA SRTM 90m (OpenTopoData)",
      source: HARDCODED_OFFICIAL_APIS.OPENTOPODATA_SRTM90M
    });
  } catch {
    return res.json({ elevationMeters: null, dataset: "srtm90m", source: "timeout-fallback" });
  }
});
app.get("/api/official/nasa-events", async (_req, res) => {
  try {
    const apiRes = await fetch(HARDCODED_OFFICIAL_APIS.NASA_EONET_V3, {
      signal: AbortSignal.timeout(5e3)
    });
    if (!apiRes.ok) {
      return res.json({ events: [], source: HARDCODED_OFFICIAL_APIS.NASA_EONET_V3 });
    }
    const data = await apiRes.json();
    const events = (data?.events || []).slice(0, 8).map((ev) => {
      const geo = ev.geometry?.[0];
      const coords = Array.isArray(geo?.coordinates) && geo.coordinates.length >= 2 ? [Number(geo.coordinates[1]), Number(geo.coordinates[0])] : void 0;
      return {
        id: ev.id,
        title: ev.title,
        category: ev.categories?.[0]?.title || "Evento Natural",
        date: geo?.date ? String(geo.date).slice(0, 10) : "",
        coordinates: coords
      };
    });
    return res.json({ events, source: HARDCODED_OFFICIAL_APIS.NASA_EONET_V3 });
  } catch {
    return res.json({ events: [], source: HARDCODED_OFFICIAL_APIS.NASA_EONET_V3 });
  }
});
app.get("/api/local/state", (_req, res) => {
  return res.json(readLocalDb());
});
app.post("/api/local/state", (req, res) => {
  if (req.body && typeof req.body === "object") {
    writeLocalDb(req.body);
  }
  return res.json({ ok: true });
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      plugins: [
        {
          name: "disable-hmr-client-ws",
          enforce: "post",
          transform(code, id) {
            if (id.includes("vite/dist/client/client.mjs") || id.endsWith("/@vite/client")) {
              return {
                code: code.replace(
                  "transport.connect(createHMRHandler(handleMessage));",
                  "/* HMR WebSocket disabled in middlewareMode */"
                ),
                map: null
              };
            }
          }
        }
      ],
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`GeoPlanetary Server listening on http://0.0.0.0:${PORT}`);
  });
}
startServer();
