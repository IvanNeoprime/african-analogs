import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
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
const apiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build"
    }
  }
});
app.post("/api/gemini/chat", async (req, res) => {
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
    if (!apiKey) {
      return res.status(500).json({
        error: "Chave de API do Gemini n\xE3o configurada no servidor. Verifique o painel Secrets."
      });
    }
    const systemInstruction = `Voc\xEA \xE9 o Analista Cient\xEDfico IA da plataforma colaborativa African Analogs (alinhado aos cat\xE1logos oficiais NASA PDS, OpenTopography SRTM DEM, USGS e ESA Europlanet).
Sua miss\xE3o \xE9 auxiliar pesquisadores individuais e equipes a realizar investiga\xE7\xF5es iniciais e validar lugares an\xE1logos na Terra (especialmente no continente africano e refer\xEAncias globais da NASA) para Marte, Lua, Europa, Enc\xE9lado, Tit\xE3 e V\xEAnus \u2014 mesmo quando n\xE3o h\xE1 c\xE2mera ou imagem de vis\xE3o computacional dispon\xEDvel, analisando diretamente descri\xE7\xF5es textuais, documentos t\xE9cnicos e arquivos CSV/JSON de campo.

Conhecimento de refer\xEAncia:
1. S\xEDtios An\xE1logos Africanos & Globais: Depress\xE3o de Danakil & Dallol (Eti\xF3pia - Marte/V\xEAnus hidrotermal hiper\xE1cido), Estrutura de Richat (Maurit\xE2nia - calibra\xE7\xE3o orbital/Marte), Mar de Areia do Namibe (Nam\xEDbia - dunas lineares de Tit\xE3/Marte), Domo de Impacto de Vredefort (\xC1frica do Sul - brechas e quartzo chocado da Lua), Lago Natron (Tanz\xE2nia - lagos alcalinos carbonatados de Enc\xE9lado), Deserto do Atacama (Chile), Lanzarote (Espanha), Borup Fiord Pass (\xC1rtico - Europa).
2. An\xE1lise de Documentos & CSV: Extraia padr\xF5es geoqu\xEDmicos (aw, pH, \xF3xidos XRF, minerais XRD), avalie limita\xE7\xF5es de habitabilidade/astrobiologia e estime o \xEDndice de fidelidade an\xE1loga (AFI).
3. Localiza\xE7\xE3o Opcional: Se o usu\xE1rio fornecer coordenadas GPS ou s\xEDtio geogr\xE1fico, relacione relevo, litologia regional e contexto topogr\xE1fico DEM; se n\xE3o fornecer, realize a an\xE1lise estritamente pelos par\xE2metros textuais ou tabulares enviados.

Diretrizes de resposta:
- Responda em Portugu\xEAs com rigor cient\xEDfico, objetividade e clareza estruturada (t\xF3picos curtos, an\xE1logo terrestre mais pr\xF3ximo, corpo planet\xE1rio compat\xEDvel, m\xE9tricas estimadas e recomenda\xE7\xF5es pr\xE1ticas de valida\xE7\xE3o).
- Evite tom informal ou sauda\xE7\xF5es gen\xE9ricas de chatbot.`;
    let contextPrompt = "";
    if (siteContext) {
      contextPrompt += `
[S\xCDTIO DE REFER\xCANCIA NO MAPA: ${siteContext.name} (${siteContext.country || ""}) | Alvo: ${siteContext.targetPlanet} | AFI: ${siteContext.fidelityScore}%]
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
[AMOSTRA ATIVA: "${activeSample.name}" | Minerais: ${JSON.stringify(activeSample.minerals)} | aw: ${activeSample.waterActivity} | pH: ${activeSample.pH}]
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
    const contents = [];
    if (contextPrompt) {
      contents.push({
        role: "user",
        parts: [{ text: `Contexto t\xE9cnico desta sess\xE3o de pesquisa:
${contextPrompt}` }]
      });
      contents.push({
        role: "model",
        parts: [{ text: "Contexto e dados carregados. Pronto para analisar os par\xE2metros e documentos." }]
      });
    }
    if (Array.isArray(messages) && messages.length > 0) {
      for (const msg of messages) {
        contents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }]
        });
      }
    }
    if (prompt && (!Array.isArray(messages) || messages.length === 0)) {
      contents.push({
        role: "user",
        parts: [
          {
            text: `Corpo planet\xE1rio de interesse inicial: ${targetPlanet}.
Solicita\xE7\xE3o do pesquisador: ${prompt}`
          }
        ]
      });
    } else if (documentContent && contents.length <= 2) {
      contents.push({
        role: "user",
        parts: [
          {
            text: `Analise o documento/CSV anexado acima para o corpo planet\xE1rio ${targetPlanet}, identifique o s\xEDtio an\xE1logo terrestre mais compat\xEDvel e apresente um parecer t\xE9cnico inicial.`
          }
        ]
      });
    }
    if (contents.length === 0) {
      return res.status(400).json({
        error: "Forne\xE7a um prompt de pesquisa ou anexe um documento/CSV para iniciar a an\xE1lise."
      });
    }
    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents,
      config: {
        systemInstruction
      }
    });
    return res.json({ reply: response.text });
  } catch (error) {
    console.error("Erro na rota /api/gemini/chat:", error);
    return res.status(500).json({
      error: error.message || "Falha ao processar solicita\xE7\xE3o com o analista planet\xE1rio."
    });
  }
});
app.post("/api/gemini/vision-analyze", async (req, res) => {
  try {
    const {
      imageBase64,
      mimeType = "image/jpeg",
      coordinates,
      targetPlanet = "Mars",
      rasterMetadata
    } = req.body;
    if (!apiKey) {
      return res.status(500).json({ error: "Chave de API do Gemini n\xE3o configurada." });
    }
    if (!imageBase64) {
      return res.status(400).json({ error: "Nenhuma imagem fornecida para an\xE1lise de vis\xE3o computacional." });
    }
    const dataUriMatch = String(imageBase64).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    const resolvedMimeType = dataUriMatch ? dataUriMatch[1] : mimeType;
    const cleanBase64 = dataUriMatch ? dataUriMatch[2] : String(imageBase64).replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
    const targetLabelMap = {
      Mars: "MARTE",
      Moon: "LUA",
      Europa: "EUROPA (J\xDAPITER)",
      Enceladus: "ENC\xC9LADO (SATURNO)",
      Titan: "TIT\xC3 (SATURNO)",
      Venus: "V\xCANUS",
      Both: "MARTE e LUA"
    };
    const targetLabel = targetLabelMap[targetPlanet] || "MARTE";
    const rasterContext = rasterMetadata ? `
[METADADOS DO RASTER / TIFF / DESCRIPTOGRAFIA]: Formato: ${rasterMetadata.detectedFormat || "Raster"} | Arquivo: ${rasterMetadata.originalFileName || "campo"} | Dimens\xF5es: ${rasterMetadata.width || "?"}x${rasterMetadata.height || "?"} px | Bandas: ${rasterMetadata.bands || 1} (${rasterMetadata.bitsPerSample || 8}-bit) | Min/M\xE9dia/M\xE1x: ${rasterMetadata.minVal ?? "-"} / ${rasterMetadata.meanVal ?? "-"} / ${rasterMetadata.maxVal ?? "-"}${rasterMetadata.wasEncrypted ? ` | Descriptografado via: ${rasterMetadata.decryptionMethod}` : ""}
` : "";
    const promptText = `Voc\xEA \xE9 o sistema avan\xE7ado de Vis\xE3o Computacional Geol\xF3gica e Reconhecimento de Terrenos Planet\xE1rios da plataforma African Analogs (alinhado aos cat\xE1logos NASA PDS e ESA Europlanet).
Analise detalhadamente esta imagem de terreno, rocha, DEM GeoTIFF ou superf\xEDcie capturada ${coordinates ? `nas coordenadas em tempo real [Lat: ${coordinates.lat}, Lng: ${coordinates.lng}]` : "em campo"}.${rasterContext}

Avalie se este terreno/rocha possui fei\xE7\xF5es an\xE1logas \xE0s de ${targetLabel}.

Responda em formato estruturado no seguinte formato textual claro em portugu\xEAs:
[CORPO_ANALOGO_PROVAVEL]: (Mars, Moon, Europa, Enceladus, Titan ou Venus)
[ESCORE_FIDELIDADE]: (um n\xFAmero de 0 a 100)
[ANALOGO_TERRESTRE_MAIS_PROXIMO]: (ex: Depress\xE3o de Danakil & Dallol, Estrutura de Richat, Mar de Areia do Namibe, Domo de Impacto de Vredefort, Lago Natron, Deserto do Atacama, Geopark de Lanzarote ou Borup Fiord Pass)
[FEICOES_GEOLOGICAS_IDENTIFICADAS]: (liste 4 a 6 fei\xE7\xF5es visuais, ex: crosta evapor\xEDtica, dunas lineares, brecha de impacto, basalto vesicular, \xF3xidos de ferro, regolito fragmentado)
[MINERAIS_DETECTADOS_VISAO]: (liste minerais prov\xE1veis deduzidos pela cor, textura e albedo)
[ADEQUACAO_INSTRUMENTAL]: (quais instrumentos espaciais se beneficiam de testes aqui, ex: Mastcam-Z, PIXL, SuperCam, SHERLOC, LROC, Cassini Radar, MISE)
[DIAGNOSTICO_CIENTIFICO]: (parecer t\xE9cnico sintetizado, sem enrola\xE7\xE3o, com rigor geol\xF3gico)`;
    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: resolvedMimeType,
              data: cleanBase64
            }
          },
          {
            text: promptText
          }
        ]
      },
      config: {
        systemInstruction: "Voc\xEA \xE9 um especialista em vis\xE3o computacional e geomorfologia comparada planet\xE1ria da NASA/ESA. Responda em portugu\xEAs t\xE9cnico e objetivo."
      }
    });
    const reply = response.text || "";
    const extract = (tag, defaultVal) => {
      const regex = new RegExp(`\\[${tag}\\]:\\s*(.+?)(?=\\n\\[|$)`, "s");
      const match = reply.match(regex);
      return match ? match[1].trim() : defaultVal;
    };
    const planetaryMatch = extract("CORPO_ANALOGO_PROVAVEL", targetPlanet);
    const scoreStr = extract("ESCORE_FIDELIDADE", "88");
    const fidelityScore = parseInt(scoreStr.replace(/\D/g, ""), 10) || 88;
    const closestAnalogue = extract("ANALOGO_TERRESTRE_MAIS_PROXIMO", "Depress\xE3o de Danakil & Dallol");
    const featuresRaw = extract("FEICOES_GEOLOGICAS_IDENTIFICADAS", "Textura de regolito, fraturamento mec\xE2nico, albedo uniforme");
    const mineralsRaw = extract("MINERAIS_DETECTADOS_VISAO", "Silicatos, \xF3xidos de ferro");
    const instruments = extract("ADEQUACAO_INSTRUMENTAL", "Mastcam-Z, ChemCam, SuperCam");
    const diagnosis = extract("DIAGNOSTICO_CIENTIFICO", reply);
    return res.json({
      success: true,
      rawText: reply,
      planetaryMatch,
      fidelityScore: Math.min(99, Math.max(30, fidelityScore)),
      closestAnalogue,
      features: featuresRaw.split(/[,;\n•-]/).map((s) => s.trim()).filter((s) => s.length > 2),
      minerals: mineralsRaw.split(/[,;\n•-]/).map((s) => s.trim()).filter((s) => s.length > 2),
      instruments,
      diagnosis
    });
  } catch (error) {
    console.error("Erro na vis\xE3o computacional:", error);
    return res.status(500).json({
      error: error.message || "Falha ao processar vis\xE3o computacional com IA."
    });
  }
});
app.post("/api/gemini/diagnostics", async (req, res) => {
  try {
    const { action, sample, site, targetPlanet, coordinates } = req.body;
    if (!apiKey) {
      return res.status(500).json({ error: "Chave de API do Gemini n\xE3o configurada." });
    }
    const actionPrompts = {
      mars_jezero_match: `Avalie a compatibilidade da amostra "${sample?.name || "Amostra de Campo"}" (${site?.name || "S\xEDtio"}) com os estratos sedimentares do delta e cratera de Jezero (Marte). Analise minerais presentes: ${JSON.stringify(sample?.minerals || {})}, aw: ${sample?.waterActivity}, pH: ${sample?.pH}.`,
      moon_shackleton_match: `Avalie a equival\xEAncia da amostra "${sample?.name || "Amostra"}" com o regolito da Bacia Polo Sul-Aitken e Cratera Shackleton (Lua), focando em anortosito, pirox\xEAnio, ilmenita, pseudotaquilito e vol\xE1teis criog\xEAnicos protegidos em regi\xF5es permanentemente sombreadas (PSRs).`,
      europa_ice_brine_match: `Avalie a correspond\xEAncia da amostra com a crosta de gelo e surg\xEAncias de salmoura rica em sulfatos hidratados de Europa (J\xFApiter) visando o espectr\xF4metro MISE da sonda Europa Clipper da NASA.`,
      enceladus_serpentine_plume: `Avalie o potencial da amostra como an\xE1logo para o oceano hidrotermal de Enc\xE9lado (Saturno), com foco em serpentiniza\xE7\xE3o abi\xF3tica, carbonatos de s\xF3dio (trona/natr\xE3o), pH hiperalcalino (9-11) e gera\xE7\xE3o de H2 e CH4 molecular detectados pela sonda Cassini.`,
      titan_hydrocarbon_dune: `Avalie a analogia da amostra e morfologia do s\xEDtio ${site?.name || ""} com as dunas org\xE2nicas de tolina e lagos de hidrocarbonetos l\xEDquidos de Tit\xE3 (Saturno) para a miss\xE3o Dragonfly da NASA.`,
      venus_supercritical_volcano: `Avalie a resist\xEAncia e equival\xEAncia mineral\xF3gica com as plan\xEDcies vulc\xE2nicas bas\xE1lticas sob atmosfera supercr\xEDtica densa e corrosiva de V\xEAnus (sondas VERITAS e DAVINCI da NASA).`,
      rover_instrument_simulation: `Simule um ensaio operacional com instrumentos de rover (SuperCam LIBS/Raman, PIXL fluoresc\xEAncia elementar, SHERLOC UV) na amostra "${sample?.name || ""}". Quais bioassinaturas ou tra\xE7os elementares seriam detectados?`,
      extremophile_biosignature: `Analise a viabilidade biol\xF3gica e preserva\xE7\xE3o de bioassinaturas considerando a atividade de \xE1gua aw=${sample?.waterActivity || 0.3}, pH=${sample?.pH || 7} e o regime de radia\xE7\xE3o do s\xEDtio an\xE1logo ${site?.name || ""}.`,
      isru_resource_detection: `Analise a viabilidade de Utiliza\xE7\xE3o de Recursos In Situ (ISRU) na amostra "${sample?.name || ""}" \u2014 extra\xE7\xE3o de \xE1gua molecular a partir de sulfatos/argilas ou oxig\xEAnio a partir de \xF3xidos de ferro/ilmenita.`
    };
    const chosenPrompt = actionPrompts[action] || `Realize um diagn\xF3stico anal\xEDtico da amostra ${sample?.name || "geol\xF3gica"} (${targetPlanet || "Mars"}, coordenadas ${JSON.stringify(coordinates || [])}).`;
    const systemInstruction = `Voc\xEA \xE9 o relator t\xE9cnico da plataforma African Analogs. Forne\xE7a diagn\xF3sticos objetivos e num\xE9ricos, sem estilo de chatbot amig\xE1vel.
Estruture a resposta com:
1. Resumo Executivo (2 linhas)
2. Score de Correspond\xEAncia (0-100%)
3. Pontos Cr\xEDticos de Valida\xE7\xE3o
4. Recomenda\xE7\xE3o Direta para o Relat\xF3rio Oficial.`;
    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: chosenPrompt,
      config: {
        systemInstruction
      }
    });
    return res.json({ result: response.text });
  } catch (error) {
    console.error("Erro na rota de diagn\xF3sticos:", error);
    return res.status(500).json({
      error: error.message || "Falha ao executar diagn\xF3stico."
    });
  }
});
app.post("/api/gemini/generate-report", async (req, res) => {
  try {
    const { sample, site, visionData, attachedDiagnostics, targetPlanet, investigator } = req.body;
    if (!apiKey) {
      return res.status(500).json({ error: "Chave de API do Gemini n\xE3o configurada." });
    }
    const reportPrompt = `Gere um Relat\xF3rio T\xE9cnico de Certifica\xE7\xE3o de S\xEDtio An\xE1logo Planet\xE1rio (Planetary Analogue Technical Report) da plataforma African Analogs no padr\xE3o formal de miss\xF5es espaciais (formato Lunar and Planetary Science Conference / COSPAR):
Investigador: ${investigator || "Pesquisador Respons\xE1vel"}
Alvo Planet\xE1rio: ${targetPlanet || "Mars"}
S\xEDtio An\xE1logo: ${site?.name || "Localiza\xE7\xE3o de Amostragem"} (${site?.country || ""} \xB7 ${site?.location || "Coordenadas em tempo real"})
Fonte Oficial de Refer\xEAncia: ${sample?.officialSource || site?.dataSource || "NASA PDS / SRTM DEM"}
Amostra: ${sample?.name || "Amostra de Regolito"}
Classifica\xE7\xE3o da Rocha: ${sample?.rockClassification || "Regolito Vulc\xE2nico / Evapor\xEDtico"}
Par\xE2metros F\xEDsico-Qu\xEDmicos: aw=${sample?.waterActivity}, pH=${sample?.pH}, Profundidade=${sample?.depthCm}cm
Composi\xE7\xE3o XRD/Mineral: ${JSON.stringify(sample?.minerals || {})}
Composi\xE7\xE3o XRF: ${JSON.stringify(sample?.xrfComposition || {})}
${visionData ? `Dados de Vis\xE3o Computacional: ${JSON.stringify(visionData)}` : ""}
${attachedDiagnostics ? `Parecer Diagn\xF3stico Anexado: ${attachedDiagnostics}` : ""}

Estrutura formal obrigat\xF3ria:
# CERTIFICADO DE FIDELIDADE AN\xC1LOGA PLANET\xC1RIA \u2014 AFRICAN ANALOGS
## 1. RESUMO EXECUTIVO E IDENTIFICA\xC7\xC3O DE MISS\xC3O
## 2. PARECER GEOMORFOL\xD3GICO & VIS\xC3O COMPUTACIONAL
## 3. EQUIVAL\xCANCIA MINERAL\xD3GICA & GEOQU\xCDMICA COMPARATIVA
## 4. AN\xC1LISE DE ESTRESSE AMBIENTAL & BIOASSINATURAS (ASTROBIOLOGIA)
## 5. RECOMENDA\xC7\xC3O DE INSTRUMENTA\xC7\xC3O ESPACIAL DE CAMPO
## 6. CONCLUS\xC3O & \xCDNDICE FINAL DE FIDELIDADE (AFI)

Use linguagem cient\xEDfica precisa em portugu\xEAs, com termos formais (petrologia, espectrometria, albedo, habitabilidade).`;
    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: reportPrompt,
      config: {
        systemInstruction: "Voc\xEA \xE9 um relator oficial do Planetary Science Division da NASA e ESA vinculado \xE0 plataforma African Analogs. Redija documentos t\xE9cnicos completos e com rigor cient\xEDfico absoluto."
      }
    });
    return res.json({ report: response.text });
  } catch (error) {
    console.error("Erro na gera\xE7\xE3o de relat\xF3rio:", error);
    return res.status(500).json({
      error: error.message || "Falha ao emitir relat\xF3rio."
    });
  }
});
app.get("/api/official/catalog", (_req, res) => {
  return res.json({
    endpoints: HARDCODED_OFFICIAL_APIS,
    aiConfigured: Boolean(apiKey),
    storageMode: "local-persistent"
  });
});
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
