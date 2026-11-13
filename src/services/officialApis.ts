import { OfficialApiEndpoint } from '../types';

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
  BACKEND_CHAT: '/api/gemini/chat',
  BACKEND_VISION: '/api/gemini/vision-analyze',
  BACKEND_DIAGNOSTICS: '/api/gemini/diagnostics',
  BACKEND_REPORT: '/api/gemini/generate-report',
  BACKEND_ELEVATION: '/api/official/elevation',
  BACKEND_NASA_EVENTS: '/api/official/nasa-events',
  BACKEND_API_CATALOG: '/api/official/catalog',
  BACKEND_LOCAL_STATE: '/api/local/state',
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
    id: 'gemini-research',
    name: 'Motor Analítico & Visão Geológica IA',
    provider: 'African Analogs Server Proxy',
    category: 'IA & Visão',
    endpoint: HARDCODED_API_ENDPOINTS.BACKEND_CHAT,
    authMode: 'Proxy Servidor Integrado',
    description: 'Rotas /api/gemini/chat, /vision-analyze, /diagnostics e /generate-report pré-conectadas.',
  },
  {
    id: 'local-ecosystem',
    name: 'Repositório Local de Contas, Perfis & Estudos',
    provider: 'Armazenamento Local Persistente',
    category: 'Contas & Armazenamento',
    endpoint: HARDCODED_API_ENDPOINTS.BACKEND_LOCAL_STATE,
    authMode: 'Proxy Servidor Integrado',
    description: 'Sincroniza cadastro de contas, perfis dinâmicos e pesquisas em armazenamento local.',
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
