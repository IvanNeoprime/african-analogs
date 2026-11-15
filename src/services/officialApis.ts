import { OfficialApiEndpoint } from '../types';
import { getCelestialBodyLabel, getCelestialNasaQuery } from '../data/celestialBodies';

/**
 * Catálogo hardcoded das APIs científicas oficiais, camadas geoespaciais NASA/DEM
 * e endpoints de processamento integrados na plataforma African Analogs.
 */
export const HARDCODED_API_ENDPOINTS = {
  // Camadas de Mapa & Satélite NASA / SRTM DEM (públicas, sem chave manual)
  NASA_GIBS_WMTS:
    'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2024-06-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
  OPENTOPO_SRTM_TILES: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  OPENTOPODATA_SRTM90M_REST: 'https://api.opentopodata.org/v1/srtm90m',
  NASA_EONET_EVENTS_REST: 'https://eonet.gsfc.nasa.gov/api/v3/events?limit=12&status=open',
  USGS_EARTHQUAKE_GEO_REST:
    'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=8&minmagnitude=4.5',

  // Endpoints internos pré-configurados no servidor Node/Express
  BACKEND_CHAT: '/api/ai/chat',
  BACKEND_VISION: '/api/ai/vision-analyze',
  BACKEND_DIAGNOSTICS: '/api/ai/diagnostics',
  BACKEND_REPORT: '/api/ai/generate-report',
  BACKEND_ELEVATION: '/api/official/elevation',
  BACKEND_NASA_EVENTS: '/api/official/nasa-events',
  BACKEND_API_CATALOG: '/api/official/catalog',
  BACKEND_SHARED_DATA: '/api/data',
} as const;

export const OFFICIAL_API_CATALOG: OfficialApiEndpoint[] = [
  {
    id: 'nasa-gibs',
    name: 'NASA GIBS MODIS Terra TrueColor WMTS',
    provider: 'NASA Earthdata / EOSDIS',
    category: 'Satélite / NASA',
    endpoint: HARDCODED_API_ENDPOINTS.NASA_GIBS_WMTS,
    authMode: 'Pública (Hardcoded)',
    description: 'Mosaico orbital contínuo de reflectância corrigida utilizado no mapa geológico.',
  },
  {
    id: 'srtm-dem-tiles',
    name: 'OpenTopoMap SRTM DEM Topográfico',
    provider: 'OpenTopoMap / NASA SRTM',
    category: 'Geoespacial / DEM',
    endpoint: HARDCODED_API_ENDPOINTS.OPENTOPO_SRTM_TILES,
    authMode: 'Pública (Hardcoded)',
    description: 'Curvas de nível e relevo altimétrico SRTM padrão do mapa principal.',
  },
  {
    id: 'srtm-elevation-rest',
    name: 'SRTM 90m Altimetria por Coordenada',
    provider: 'OpenTopoData / NASA SRTM90m',
    category: 'Geoespacial / DEM',
    endpoint: HARDCODED_API_ENDPOINTS.BACKEND_ELEVATION,
    authMode: 'Proxy Servidor Integrado',
    description: 'Consulta altimetria oficial em metros para coordenadas GPS ou GeoTIFF.',
  },
  {
    id: 'nasa-eonet',
    name: 'NASA EONET v3 Eventos Naturais & Vulcânicos',
    provider: 'NASA Earth Observatory',
    category: 'Satélite / NASA',
    endpoint: HARDCODED_API_ENDPOINTS.BACKEND_NASA_EVENTS,
    authMode: 'Proxy Servidor Integrado',
    description: 'Monitoramento em tempo real de vulcões, poeira desértica e eventos térmicos ativos.',
  },
  {
    id: 'nvidia-nemotron-copilot',
    name: 'Copiloto Científico NVIDIA Nemotron 3.5',
    provider: 'NVIDIA NIM (nvidia/nemotron-3.5-lightning-30b-a3b)',
    category: 'IA & Visão',
    endpoint: HARDCODED_API_ENDPOINTS.BACKEND_CHAT,
    authMode: 'Proxy Servidor Integrado',
    description: 'Modelo Nemotron 3.5 Lightning com chave hardcoded no servidor para chat, visão e diagnósticos.',
  },
  {
    id: 'local-ecosystem',
    name: 'Base de Dados Partilhada (SQLite)',
    provider: 'Servidor African Analogs',
    category: 'Contas & Armazenamento',
    endpoint: HARDCODED_API_ENDPOINTS.BACKEND_SHARED_DATA,
    authMode: 'Proxy Servidor Integrado',
    description: 'Estudos, perfis públicos, discussões e grupos, guardados registo a registo com dono.',
  },
];

export interface ElevationLookupResult {
  elevationMeters: number | null;
  dataset: string;
  source: string;
}

export async function fetchOfficialElevation(lat: number, lng: number): Promise<ElevationLookupResult> {
  try {
    const res = await fetch(
      `${HARDCODED_API_ENDPOINTS.BACKEND_ELEVATION}?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
    );
    if (!res.ok) {
      return { elevationMeters: null, dataset: 'srtm90m', source: 'offline-fallback' };
    }
    return await res.json();
  } catch {
    return { elevationMeters: null, dataset: 'srtm90m', source: 'offline-fallback' };
  }
}

export interface NasaEonetEventItem {
  id: string;
  title: string;
  category: string;
  date: string;
  coordinates?: [number, number];
}

export async function fetchOfficialNasaEvents(): Promise<NasaEonetEventItem[]> {
  try {
    const res = await fetch(HARDCODED_API_ENDPOINTS.BACKEND_NASA_EVENTS);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.events) ? data.events : [];
  } catch {
    return [];
  }
}

export type NasaShortcutCategory = 'datasets' | 'imagery' | 'missions';

export interface NasaDataShortcut {
  id: string;
  title: string;
  provider: string;
  category: NasaShortcutCategory;
  formats: string;
  url: string;
  description: string;
  howToUseHere: string;
}

export const NASA_DATA_SHORTCUTS: NasaDataShortcut[] = [
  {
    id: 'nasa-pds-main',
    title: 'NASA PDS (Planetary Data System)',
    provider: 'NASA Oficial · Arquivo Planetário',
    category: 'datasets',
    formats: 'CSV · Tabelas · Espectros',
    url: 'https://pds.nasa.gov/',
    description:
      'Repositório oficial com todos os dados públicos de missões da NASA em Marte, Lua, Titã, Europa, Encélado e Vênus.',
    howToUseHere: 'Baixe tabelas ou arquivos CSV/JSON e importe em "Importar Planilha" ou no Copiloto IA.',
  },
  {
    id: 'nasa-pds-geosciences',
    title: 'NASA PDS Geosciences Node (Rovers)',
    provider: 'NASA / Washington University',
    category: 'missions',
    formats: 'Dados XRF · XRD · Solo de Marte',
    url: 'https://pds-geosciences.wustl.edu/',
    description:
      'Dados geológicos reais dos rovers Perseverance, Curiosity e sondas MRO/LRO, incluindo composição mineral e química de rochas.',
    howToUseHere: 'Consulte teores de minerais e óxidos para digitar em "Dados Manuais" ou comparar nos gráficos.',
  },
  {
    id: 'nasa-earthdata-search',
    title: 'NASA Earthdata Search (Satélite & DEM)',
    provider: 'NASA EOSDIS Earthdata',
    category: 'imagery',
    formats: 'GeoTIFF · SRTM DEM · Satélite',
    url: 'https://search.earthdata.nasa.gov/',
    description:
      'Portal gratuito de imagens de satélite e modelos de elevação digital (SRTM) para desertos africanos e áreas de estudo na Terra.',
    howToUseHere: 'Baixe arquivos GeoTIFF ou imagens e envie na aba "Foto / Câmera" para análise do terreno.',
  },
  {
    id: 'nasa-worldview',
    title: 'NASA Worldview (Imagens Orbitais Diárias)',
    provider: 'NASA GIBS / EOSDIS',
    category: 'imagery',
    formats: 'PNG · JPEG · GeoTIFF',
    url: 'https://worldview.earthdata.nasa.gov/',
    description:
      'Mapa de satélite atualizado diariamente que permite visualizar e baixar recortes de tempestades de poeira, dunas e lagos salinos.',
    howToUseHere: 'Exporte um recorte em PNG/JPG/GeoTIFF e carregue em "Foto / Câmera".',
  },
  {
    id: 'nasa-trek',
    title: 'NASA Mars & Moon Trek (Mapas 3D/DEM)',
    provider: 'NASA Solar System Treks',
    category: 'missions',
    formats: 'GeoTIFF · Elevação · Crateras',
    url: 'https://trek.nasa.gov/',
    description:
      'Mapas oficiais da NASA para Marte, Lua e outros mundos com ferramenta para baixar recortes de relevo e comparar crateras.',
    howToUseHere: 'Baixe recortes de superfície para comparar com lugares africanos no Copiloto Visual.',
  },
  {
    id: 'nasa-mars-raw',
    title: 'NASA Mars Raw Images (Perseverance & Curiosity)',
    provider: 'NASA JPL Mars Exploration',
    category: 'imagery',
    formats: 'Fotos Reais · JPG / PNG',
    url: 'https://mars.nasa.gov/mars2020/multimedia/raw-images/',
    description:
      'Galeria pública com milhares de fotos reais de rochas, regolito e camadas sedimentares tiradas na superfície de Marte.',
    howToUseHere: 'Salve uma foto de rocha marciana e teste a comparação visual na aba "Foto / Câmera".',
  },
  {
    id: 'nasa-hirise',
    title: 'NASA MRO HiRISE (Alta Resolução de Marte)',
    provider: 'NASA JPL / Univ. of Arizona',
    category: 'missions',
    formats: 'Imagens Orbitais · Dunas e Rochas',
    url: 'https://www.uahirise.org/catalog/',
    description:
      'Catálogo orbital de altíssima resolução mostrando dunas, deltas antigos e depósitos minerais na superfície de Marte.',
    howToUseHere: 'Use as imagens para comparar morfologia com o Mar de Areia do Namibe ou Estrutura de Richat.',
  },
  {
    id: 'nasa-usgs-speclib',
    title: 'Biblioteca Espectral USGS / NASA',
    provider: 'USGS & Calibração NASA PDS',
    category: 'datasets',
    formats: 'Espectros · Minerais · ASCII/CSV',
    url: 'https://crustal.usgs.gov/speclab/QueryAll07a.php',
    description:
      'Assinaturas espectrais laboratoriais de referência (hematita, gipsita, basalto, argilas) usadas por sondas espaciais.',
    howToUseHere: 'Consulte espectros e minerais de referência para validar suas amostras manuais.',
  },
  {
    id: 'nasa-open-data',
    title: 'NASA Open Data Portal',
    provider: 'NASA Data.gov',
    category: 'datasets',
    formats: 'CSV · JSON · Datasets Abertos',
    url: 'https://data.nasa.gov/',
    description:
      'Portal de dados abertos da NASA com planilhas sobre meteoritos, astrobiologia, condições atmosféricas e missões espaciais.',
    howToUseHere: 'Baixe conjuntos de dados em CSV ou JSON e envie ao Copiloto IA para interpretação.',
  },
  {
    id: 'nasa-sservi-analogs',
    title: 'NASA SSERVI — Análogos Terrestres',
    provider: 'NASA Exploration Science Institute',
    category: 'missions',
    formats: 'Guias de Campo · Análogos',
    url: 'https://sservi.nasa.gov/',
    description:
      'Programas de pesquisa e campanhas de campo em locais terrestres extremos usados pela NASA para testar instrumentos lunares e marcianos.',
    howToUseHere: 'Encontre referências científicas para enriquecer suas notas e artigos publicados.',
  },
];

export function buildNasaWorldviewUrl(lat: number, lng: number): string {
  const minLng = Math.max(-180, lng - 4).toFixed(2);
  const minLat = Math.max(-85, lat - 4).toFixed(2);
  const maxLng = Math.min(180, lng + 4).toFixed(2);
  const maxLat = Math.min(85, lat + 4).toFixed(2);
  return `https://worldview.earthdata.nasa.gov/?v=${minLng},${minLat},${maxLng},${maxLat}`;
}

export function buildNasaImagesSearchUrl(targetPlanet: string): string {
  const q = getCelestialNasaQuery(targetPlanet);
  return `https://images.nasa.gov/search-results?q=${encodeURIComponent(q)}`;
}

export function buildNasaOpenDataSearchUrl(targetPlanet: string): string {
  const label = getCelestialBodyLabel(targetPlanet);
  const q = targetPlanet === 'Both' ? 'Mars Moon' : `${targetPlanet} ${label}`;
  return `https://data.nasa.gov/browse?q=${encodeURIComponent(q)}`;
}

export function downloadNasaCsvTemplate(): void {
  const csvContent = [
    // Leave a cell empty when you did not measure it: empty values are flagged as
    // "not measured" and excluded from the similarity score (nothing is guessed).
    'name,siteId,collector,institution,date,lat,lng,depth,aw,ph,porosity,target,classification,minerals,SiO2,Fe2O3,Al2O3,MgO,CaO,source,notes',
    '"Amostra exemplo — substitua pelos seus dados",danakil,"Seu Nome","Sua Instituição",2026-01-15,14.2417,40.2994,5,0.28,3.2,22,Mars,"Evaporito / basalto alterado","Jarosita: 30; Halita: 25; Gesso: 20; Hematita: 10",42.1,18.3,9.7,3.2,6.4,"Medição de campo / NASA PDS","Exemplo ilustrativo"',
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'modelo_planilha_nasa_african_analogs.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

