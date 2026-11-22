import { GeologicalSample, PlanetaryTarget, SpectralPoint } from '../types';
import { CELESTIAL_BODIES, bodyNames } from '../data/celestialBodies';

export interface MultispectralBands {
  blue: number;      // ~480nm (Band 2 Landsat 8/Sentinel-2)
  green: number;     // ~560nm (Band 3)
  red: number;       // ~650nm (Band 4)
  nir: number;       // ~860nm (Band 5 / Band 8)
  swir1: number;     // ~1600nm (Band 6 / Band 11)
  swir2: number;     // ~2200nm (Band 7 / Band 12)
  thermalIr?: number;// ~11000nm (TIRS Band 10)
}

export interface SpectralIndices {
  ferricIron: number;         // Red / Blue (Fe3+ charge transfer)
  ferrousMinerals: number;    // SWIR1 / NIR (Fe2+ in silicates)
  clayHydration: number;      // SWIR1 / SWIR2 (Al-OH / Fe-OH absorption)
  basaltPyroxene: number;     // NIR / (Red + SWIR1) (Lunar mare basalt)
  carbonateIndex: number;     // SWIR1 / (Red + Green) (Hydrothermal carbonatite)
  ndvi: number;               // (NIR - Red) / (NIR + Red) (Zero on Mars/Moon)
}

export function computeSpectralIndices(bands: MultispectralBands): SpectralIndices {
  const safeDiv = (num: number, den: number): number => {
    return den === 0 ? 0 : parseFloat((num / den).toFixed(3));
  };

  const ferricIron = safeDiv(bands.red, Math.max(bands.blue, 0.01));
  const ferrousMinerals = safeDiv(bands.swir1, Math.max(bands.nir, 0.01));
  const clayHydration = safeDiv(bands.swir1, Math.max(bands.swir2, 0.01));
  const basaltPyroxene = safeDiv(bands.nir, Math.max(bands.red + bands.swir1, 0.02));
  const carbonateIndex = safeDiv(bands.swir1, Math.max(bands.red + bands.green, 0.02));
  const ndviDen = bands.nir + bands.red;
  const ndvi = ndviDen === 0 ? 0 : parseFloat(((bands.nir - bands.red) / ndviDen).toFixed(3));

  return {
    ferricIron,
    ferrousMinerals,
    clayHydration,
    basaltPyroxene,
    carbonateIndex,
    ndvi,
  };
}

// Generate continuous spectral reflectance curve from sample mineralogy
export function generateSpectralReflectanceCurve(
  minerals: { [mineralName: string]: number } = {}
): SpectralPoint[] {
  const wavelengths = [
    400, 480, 560, 650, 750, 860, 950, 1050, 1200, 1400, 1600, 1800, 1900, 2050, 2200, 2350, 2500
  ];

  // Base continuum slope
  return wavelengths.map((wl) => {
    let reflectance = 0.15 + (wl / 2500) * 0.25;

    // Check mineral contributions
    for (const [mineral, pct] of Object.entries(minerals)) {
      const weight = (pct || 0) / 100;
      const lower = mineral.toLowerCase();

      // Hematite / Iron oxides: steep drop in UV/blue, high in red/NIR
      if (lower.includes('hematit') || lower.includes('ferro') || lower.includes('goethit')) {
        if (wl < 550) reflectance -= 0.12 * weight;
        if (wl >= 700 && wl <= 900) reflectance += 0.18 * weight;
        if (wl >= 850 && wl <= 920) reflectance -= 0.05 * weight; // 860nm absorption
      }

      // Olivine: strong broad absorption feature centered at 1050 nm
      if (lower.includes('olivin')) {
        if (wl >= 850 && wl <= 1250) {
          const dip = 1 - Math.exp(-Math.pow((wl - 1050) / 120, 2));
          reflectance -= 0.18 * weight * (1 - dip);
        }
      }

      // Pyroxene: absorption doublet at 1000 nm and 2000 nm
      if (lower.includes('pirox') || lower.includes('augita') || lower.includes('pigeonita')) {
        if (Math.abs(wl - 1000) < 150) reflectance -= 0.14 * weight;
        if (Math.abs(wl - 2000) < 180) reflectance -= 0.16 * weight;
      }

      // Gypsum / Hydrated Sulfates: water dips at 1400nm and 1900nm
      if (lower.includes('gesso') || lower.includes('sulfat') || lower.includes('jarosit')) {
        if (Math.abs(wl - 1400) < 60) reflectance -= 0.22 * weight;
        if (Math.abs(wl - 1900) < 70) reflectance -= 0.28 * weight;
      }

      // Clay / Smectite / Montmorillonite: Al-OH / Fe-OH absorption at 2200nm
      if (lower.includes('argil') || lower.includes('esmectit') || lower.includes('montmoril') || lower.includes('caolin')) {
        if (Math.abs(wl - 1400) < 50) reflectance -= 0.15 * weight;
        if (Math.abs(wl - 2200) < 60) reflectance -= 0.24 * weight;
      }

      // Carbonates (Calcite/Dolomite): strong absorption band at 2300-2350nm
      if (lower.includes('calcit') || lower.includes('dolomit') || lower.includes('carbonat')) {
        if (Math.abs(wl - 2330) < 70) reflectance -= 0.26 * weight;
      }

      // Ilmenite (lunar opaque): suppresses overall albedo heavily
      if (lower.includes('ilmenit') || lower.includes('magnetit')) {
        reflectance *= Math.max(0.4, 1 - 0.7 * weight);
      }
    }

    // Clamp reflectance between 0.02 and 0.85
    reflectance = Math.max(0.02, Math.min(0.85, reflectance));
    return {
      wavelengthNm: wl,
      reflectance: parseFloat(reflectance.toFixed(3)),
    };
  });
}

// The Analogue Fidelity Index lives in its own module (documented there).
export { computeAnalogueFidelity } from './analogueFidelity';

/** RFC 4180-style CSV parser: quoted fields, escaped quotes ("") and commas/newlines inside quotes. */
export function parseCsv(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, '');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c.length > 0));
}

/** "Hematita: 30; Gesso: 20" or "Hematita=30|Gesso=20" → { Hematita: 30, Gesso: 20 } */
export function parseCompositionList(raw: string | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw) return out;
  for (const part of raw.split(/[;|]+/)) {
    const m = part.match(/^\s*(.+?)\s*[:=]\s*(-?\d+(?:[.,]\d+)?)\s*%?\s*$/);
    if (m) out[m[1]] = parseFloat(m[2].replace(',', '.'));
  }
  return out;
}

const OXIDE_COLUMNS = ['sio2', 'tio2', 'al2o3', 'fe2o3', 'feo', 'mno', 'mgo', 'cao', 'na2o', 'k2o', 'p2o5', 'so3', 'cl'];
const OXIDE_LABEL: Record<string, string> = {
  sio2: 'SiO2', tio2: 'TiO2', al2o3: 'Al2O3', fe2o3: 'Fe2O3', feo: 'FeO', mno: 'MnO', mgo: 'MgO',
  cao: 'CaO', na2o: 'Na2O', k2o: 'K2O', p2o5: 'P2O5', so3: 'SO3', cl: 'Cl',
};

const toNumber = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

export interface ParsedSampleRow extends Partial<GeologicalSample> {
  /** Fields the file did not provide. The caller decides how to fill them; the AFI ignores them. */
  unmeasured: NonNullable<GeologicalSample['unmeasured']>;
}

function buildRow(get: (...keys: string[]) => string | undefined, rawMinerals: Record<string, number>, rawXrf: Record<string, number>, index: number, filename: string): ParsedSampleRow {
  const unmeasured: ParsedSampleRow['unmeasured'] = [];
  const lat = toNumber(get('lat', 'latitude'));
  const lng = toNumber(get('lng', 'lon', 'long', 'longitude'));
  const aw = toNumber(get('aw', 'water_activity', 'atividade_agua'));
  const ph = toNumber(get('ph'));
  const depth = toNumber(get('depth', 'depth_cm', 'profundidade'));
  const porosity = toNumber(get('porosity', 'porosidade', 'porosity_percent'));

  const validLatLng = lat !== undefined && lng !== undefined && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  if (!validLatLng) unmeasured.push('coordinates');
  if (aw === undefined || aw < 0 || aw > 1) unmeasured.push('waterActivity');
  if (ph === undefined || ph < 0 || ph > 14) unmeasured.push('pH');
  if (depth === undefined) unmeasured.push('depthCm');
  if (porosity === undefined) unmeasured.push('porosityPercent');
  if (Object.keys(rawMinerals).length === 0) unmeasured.push('minerals');
  if (Object.keys(rawXrf).length === 0) unmeasured.push('xrfComposition');

  return {
    name: get('name', 'nome', 'amostra') || `Amostra importada #${index}`,
    siteId: get('siteid', 'site_id', 'sitio'),
    collectorName: get('collector', 'collectorname', 'coletor'),
    institution: get('institution', 'instituicao', 'instituição'),
    collectedAt: get('date', 'data', 'collectedat'),
    coordinates: validLatLng ? [lat!, lng!] : undefined,
    depthCm: depth,
    rockClassification: get('classification', 'classificacao', 'classificação', 'rockclassification'),
    targetPlanet: resolveCsvTargetPlanet(get('target', 'planeta', 'astro', 'targetplanet')),
    waterActivity: unmeasured.includes('waterActivity') ? undefined : aw,
    pH: unmeasured.includes('pH') ? undefined : ph,
    porosityPercent: porosity,
    minerals: rawMinerals,
    xrfComposition: rawXrf,
    fieldNotes: get('notes', 'notas', 'fieldnotes') || `Importado de ${filename}.`,
    officialSource: get('source', 'fonte', 'officialsource') || `Ficheiro importado (${filename})`,
    version: 'v1.0.0-import',
    status: 'draft',
    unmeasured,
  };
}

/**
 * Parses user CSV/JSON files into partial samples. Nothing is invented: values the file does
 * not contain are left empty and listed in `unmeasured`.
 *
 * CSV columns (case-insensitive, PT or EN): name, siteId, collector, institution, date, lat, lng,
 * depth, aw, ph, porosity, target, classification, notes, source,
 * minerals ("Hematita: 30; Gesso: 20") or one column per mineral as "mineral:Hematita",
 * and oxide columns SiO2, Fe2O3, Al2O3, MgO, CaO, ... (wt%).
 */
export function parseUserInjectedData(rawText: string, filename: string): ParsedSampleRow[] {
  const trimmed = rawText.trim().replace(/^﻿/, '');
  const isJson = filename.toLowerCase().endsWith('.json') || trimmed.startsWith('{') || trimmed.startsWith('[');

  if (isJson) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (e: any) {
      throw new Error(`Erro ao interpretar JSON: ${e.message}`);
    }
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    return arr.map((item: any, idx) => {
      const lower: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(item || {})) lower[k.toLowerCase()] = v;
      const get = (...keys: string[]) => {
        for (const k of keys) {
          const v = lower[k.toLowerCase()];
          if (v !== undefined && v !== null && v !== '') return String(v);
        }
        return undefined;
      };
      const minerals: Record<string, number> = {};
      if (item?.minerals && typeof item.minerals === 'object') {
        for (const [k, v] of Object.entries(item.minerals)) {
          const n = toNumber(v);
          if (n !== undefined) minerals[k] = n;
        }
      } else if (typeof item?.minerals === 'string') {
        Object.assign(minerals, parseCompositionList(item.minerals));
      }
      const xrf: Record<string, number> = {};
      const xrfSrc = item?.xrfComposition || item?.xrf;
      if (xrfSrc && typeof xrfSrc === 'object') {
        for (const [k, v] of Object.entries(xrfSrc)) {
          const n = toNumber(v);
          if (n !== undefined) xrf[k] = n;
        }
      }
      const row = buildRow(get, minerals, xrf, idx + 1, filename);
      if (Array.isArray(item?.coordinates) && item.coordinates.length === 2) {
        const [la, ln] = item.coordinates.map(Number);
        if (Number.isFinite(la) && Number.isFinite(ln)) {
          row.coordinates = [la, ln];
          row.unmeasured = row.unmeasured.filter((f) => f !== 'coordinates');
        }
      }
      return row;
    });
  }

  const delimiter = (trimmed.split(/\r?\n/)[0].match(/;/g) || []).length > (trimmed.split(/\r?\n/)[0].match(/,/g) || []).length ? ';' : ',';
  const rows = parseCsv(trimmed, delimiter);
  if (rows.length < 2) {
    throw new Error('O ficheiro CSV deve conter um cabeçalho e pelo menos uma linha de dados.');
  }
  const header = rows[0].map((h) => h.trim());
  const headerLower = header.map((h) => h.toLowerCase());

  return rows.slice(1).map((cols, i) => {
    const get = (...keys: string[]) => {
      for (const k of keys) {
        const idx = headerLower.indexOf(k.toLowerCase());
        if (idx >= 0 && cols[idx] !== undefined && cols[idx] !== '') return cols[idx];
      }
      return undefined;
    };

    const minerals = parseCompositionList(get('minerals', 'minerais'));
    headerLower.forEach((h, idx) => {
      const m = h.match(/^(?:mineral|mineral_|min)[:_](.+)$/);
      const n = toNumber(cols[idx]);
      if (m && n !== undefined) minerals[header[idx].slice(header[idx].search(/[:_]/) + 1).trim()] = n;
    });

    const xrf: Record<string, number> = {};
    headerLower.forEach((h, idx) => {
      if (OXIDE_COLUMNS.includes(h)) {
        const n = toNumber(cols[idx]);
        if (n !== undefined) xrf[OXIDE_LABEL[h]] = n;
      }
    });

    return buildRow(get, minerals, xrf, i + 1, filename);
  });
}

function resolveCsvTargetPlanet(raw?: string): PlanetaryTarget | undefined {
  if (!raw) return undefined;
  const normalized = raw.trim().toLowerCase();
  const matched = CELESTIAL_BODIES.find(
    (b) => bodyNames(b).some((n) => n.toLowerCase() === normalized)
  );
  return matched ? matched.id : undefined;
}
