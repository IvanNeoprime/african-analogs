import { GeologicalSample, SpectralPoint } from '../types';

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

// Compute Planetary Analogue Fidelity Index (AFI)
export function computeAnalogueFidelity(
  sample: Partial<GeologicalSample>,
  targetPlanet: 'Mars' | 'Moon' | 'Europa' | 'Enceladus' | 'Titan' | 'Venus' | 'Both'
): {
  mineralogy: number;
  geomorphology: number;
  geochemistry: number;
  radiation: number;
  thermal: number;
  total: number;
} {
  let minScore = 80;
  let geoScore = 85;
  let chemScore = 82;
  let radScore = 75;
  let thermScore = 78;

  const minerals = sample.minerals || {};
  const mineralKeys = Object.keys(minerals).map(k => k.toLowerCase());

  if (targetPlanet === 'Mars' || targetPlanet === 'Both') {
    if (mineralKeys.some(k => k.includes('perclorat') || k.includes('clorat'))) minScore += 8;
    if (mineralKeys.some(k => k.includes('gesso') || k.includes('anidrit') || k.includes('sulfat'))) minScore += 6;
    if (mineralKeys.some(k => k.includes('hematit') || k.includes('jarosit'))) minScore += 5;
    if (mineralKeys.some(k => k.includes('argil') || k.includes('esmectit'))) minScore += 4;

    if (sample.waterActivity !== undefined) {
      if (sample.waterActivity < 0.35) chemScore += 10;
      else if (sample.waterActivity < 0.6) chemScore += 4;
      else chemScore -= 8;
    }
    if (sample.pH !== undefined && (sample.pH < 3.5 || sample.pH > 9.0)) chemScore += 6;
  } else if (targetPlanet === 'Moon') {
    if (mineralKeys.some(k => k.includes('plagiocl') || k.includes('anortosit'))) minScore += 9;
    if (mineralKeys.some(k => k.includes('pirox') || k.includes('augita'))) minScore += 6;
    if (mineralKeys.some(k => k.includes('ilmenit'))) minScore += 6;
    if (sample.porosityPercent && sample.porosityPercent > 20) geoScore += 5;
  } else if (targetPlanet === 'Europa') {
    if (mineralKeys.some(k => k.includes('gelo') || k.includes('sulfat') || k.includes('enxofre'))) minScore += 10;
    if (mineralKeys.some(k => k.includes('gesso') || k.includes('mirabilit'))) minScore += 6;
    thermScore += 12;
    radScore += 8;
  } else if (targetPlanet === 'Enceladus') {
    if (mineralKeys.some(k => k.includes('brucit') || k.includes('serpentin') || k.includes('calcit'))) minScore += 10;
    if (sample.pH !== undefined && sample.pH >= 9.0) chemScore += 12;
    geoScore += 6;
  } else if (targetPlanet === 'Titan') {
    if (mineralKeys.some(k => k.includes('organ') || k.includes('betume') || k.includes('hidrocarbon'))) minScore += 12;
    if (sample.waterActivity !== undefined && sample.waterActivity < 0.25) chemScore += 10;
    geoScore += 8;
  } else if (targetPlanet === 'Venus') {
    if (mineralKeys.some(k => k.includes('basalt') || k.includes('enxofre') || k.includes('cloro'))) minScore += 9;
    if (sample.pH !== undefined && sample.pH < 3.0) chemScore += 10;
    thermScore += 14;
  }

  // Cap all scores between 40 and 99
  const cap = (v: number) => Math.min(99, Math.max(45, Math.round(v)));
  const finalMin = cap(minScore);
  const finalGeo = cap(geoScore);
  const finalChem = cap(chemScore);
  const finalRad = cap(radScore);
  const finalTherm = cap(thermScore);

  const total = parseFloat(((finalMin * 0.35 + finalGeo * 0.20 + finalChem * 0.20 + finalRad * 0.15 + finalTherm * 0.10)).toFixed(1));

  return {
    mineralogy: finalMin,
    geomorphology: finalGeo,
    geochemistry: finalChem,
    radiation: finalRad,
    thermal: finalTherm,
    total,
  };
}

// CSV/JSON Data Parser for User Geological Injection
export function parseUserInjectedData(rawText: string, filename: string): Partial<GeologicalSample>[] {
  const isJson = filename.endsWith('.json') || rawText.trim().startsWith('{') || rawText.trim().startsWith('[');

  if (isJson) {
    try {
      const parsed = JSON.parse(rawText);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      return arr.map((item, idx) => ({
        id: item.id || `inj-${Date.now()}-${idx}`,
        name: item.name || `Amostra Importada ${idx + 1}`,
        siteId: item.siteId || 'atacama',
        collectorName: item.collectorName || 'Pesquisador Anônimo',
        institution: item.institution || 'Instituição Científica Colaborativa',
        collectedAt: item.collectedAt || new Date().toISOString().split('T')[0],
        coordinates: item.coordinates || [-24.089, -69.873],
        depthCm: item.depthCm || 5.0,
        rockClassification: item.rockClassification || 'Regolito Análogo Não Classificado',
        targetPlanet: item.targetPlanet || 'Mars',
        waterActivity: item.waterActivity !== undefined ? item.waterActivity : 0.35,
        pH: item.pH !== undefined ? item.pH : 7.0,
        porosityPercent: item.porosityPercent || 18.0,
        minerals: item.minerals || { 'Silicatos': 60, 'Óxidos de Ferro': 25, 'Sulfatos': 15 },
        xrfComposition: item.xrfComposition || { 'SiO2': 52.0, 'Fe2O3': 18.4, 'Al2O3': 14.1 },
        fieldNotes: item.fieldNotes || 'Dados injetados via upload JSON.',
        version: 'v1.0.0-user-injected',
        status: 'draft',
      }));
    } catch (e: any) {
      throw new Error(`Erro ao interpretar JSON: ${e.message}`);
    }
  }

  // Parse CSV
  const lines = rawText.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('O arquivo CSV deve conter um cabeçalho e pelo menos uma linha de dados.');
  }

  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const results: Partial<GeologicalSample>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    if (cols.length < 2) continue;

    const row: any = {};
    header.forEach((key, colIdx) => {
      row[key] = cols[colIdx] || '';
    });

    const sampleName = row['name'] || row['nome'] || row['amostra'] || `Amostra CSV #${i}`;
    const lat = parseFloat(row['lat'] || row['latitude'] || '-24.089');
    const lng = parseFloat(row['lng'] || row['lon'] || row['longitude'] || '-69.873');
    const depth = parseFloat(row['depth'] || row['profundidade'] || '5');
    const aw = parseFloat(row['aw'] || row['water_activity'] || '0.38');
    const ph = parseFloat(row['ph'] || '7.0');

    results.push({
      id: `inj-csv-${Date.now()}-${i}`,
      name: sampleName,
      siteId: row['siteid'] || row['sitio'] || 'atacama',
      collectorName: row['collector'] || row['coletor'] || 'Equipe Científica',
      institution: row['institution'] || row['instituicao'] || 'Consórcio Internacional',
      collectedAt: row['date'] || row['data'] || new Date().toISOString().split('T')[0],
      coordinates: [isNaN(lat) ? -24.089 : lat, isNaN(lng) ? -69.873 : lng],
      depthCm: isNaN(depth) ? 5 : depth,
      rockClassification: row['classification'] || row['classificacao'] || 'Regolito Vulcânico/Evaporito',
      targetPlanet: (row['target'] && (row['target'].toLowerCase().includes('moon') || row['target'].toLowerCase().includes('lua'))) ? 'Moon' : 'Mars',
      waterActivity: isNaN(aw) ? 0.38 : aw,
      pH: isNaN(ph) ? 7.0 : ph,
      porosityPercent: 20.0,
      minerals: {
        'Minerais de Ferro/Silicato': 55,
        'Sulfatos / Evaporitos': 30,
        'Outros': 15,
      },
      xrfComposition: {
        'SiO2': 49.5,
        'Fe2O3': 16.2,
        'CaO': 8.4,
      },
      fieldNotes: row['notes'] || row['notas'] || `Injetado via CSV (${filename})`,
      version: 'v1.0.0-user-injected',
      status: 'draft',
    });
  }

  return results;
}
