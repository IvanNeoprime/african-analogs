import type { AnalogueSite, GeologicalSample, PlanetaryTarget, UnmeasuredField } from '../types';

/**
 * Analogue Fidelity Index (AFI)
 * -----------------------------
 * Compares what was *measured in the sample* with a reference profile of the target body:
 *
 *  - mineralogy  : share of the sample's mineral mass that belongs to the target's indicator
 *                  mineral classes, plus how many distinct indicator classes are present.
 *  - geochemistry: distance of water activity (aw) and pH from the target's reference range.
 *
 * The total uses ONLY those two sample-derived components. Geomorphology, radiation and
 * thermal describe the field *site*, not the sample, so they are copied from the reference
 * site (when given) for the radar chart and never inflate the sample's score.
 *
 * Missing or placeholder inputs score nothing: an empty sample scores 0, not ~80%.
 * Reference ranges are deliberately broad, literature-level summaries (see notes per body);
 * they are a screening aid, not a substitute for a published comparison.
 */

interface MineralClass {
  label: string;
  keywords: string[];
}

interface TargetProfile {
  label: string;
  classes: MineralClass[];
  /** Acceptable water activity range for an analogue of this body, if meaningful. */
  aw?: [number, number];
  /** Acceptable pH range for an analogue of this body, if meaningful. */
  pH?: [number, number];
  /** Shown to the user when the comparison is not meaningful. */
  caveat?: string;
}

const C = {
  sulfates: { label: 'sulfatos', keywords: ['sulfat', 'gesso', 'gipsita', 'anidrit', 'jarosit', 'kieserit', 'epsomit', 'mirabilit', 'alunit'] },
  ironOxides: { label: 'óxidos de ferro', keywords: ['hematit', 'goethit', 'magnetit', 'ferridrit', 'óxido de ferro', 'oxido de ferro', 'óxidos de ferro', 'ferro'] },
  phyllosilicates: { label: 'filossilicatos/argilas', keywords: ['argil', 'esmectit', 'montmoril', 'nontronit', 'saponit', 'caulin', 'caolin', 'clorit', 'ilit'] },
  chlorides: { label: 'cloretos/percloratos', keywords: ['perclorat', 'clorat', 'cloret', 'halit', 'silvit', 'sal-gema', 'nacl'] },
  mafic: { label: 'silicatos máficos', keywords: ['basalt', 'olivin', 'pirox', 'augit', 'pigeonit', 'plagiocl', 'forsterit'] },
  carbonates: { label: 'carbonatos', keywords: ['carbonat', 'calcit', 'dolomit', 'siderit', 'magnesit', 'aragonit'] },
  silica: { label: 'sílica hidratada', keywords: ['opal', 'sílica', 'silica', 'calcedon'] },
  anorthosite: { label: 'plagioclásio/anortosito', keywords: ['plagiocl', 'anortosit', 'anortit', 'feldspat'] },
  ilmenite: { label: 'ilmenite/opacos', keywords: ['ilmenit', 'espinel', 'cromit'] },
  impact: { label: 'produtos de impacto', keywords: ['brecha', 'pseudotaquilit', 'quartzo chocado', 'vidro', 'impactit', 'coesit', 'stishovit', 'fusão'] },
  sulfur: { label: 'enxofre/sulfetos', keywords: ['enxofre', 'sulfet', 'pirit', 'pirrotit', 'so2'] },
  ice: { label: 'gelo', keywords: ['gelo', 'ice'] },
  hydratedSalts: { label: 'sais hidratados', keywords: ['sulfat', 'mirabilit', 'epsomit', 'halit', 'cloret', 'natr', 'trona', 'carbonato de sódio'] },
  serpentine: { label: 'serpentinização', keywords: ['serpentin', 'brucit', 'talco', 'magnetit'] },
  sodaCarbonates: { label: 'carbonatos de sódio', keywords: ['trona', 'natr', 'nahcolit', 'carbonato de sódio', 'carbonat'] },
  ammoniated: { label: 'filossilicatos amoniados', keywords: ['amoni', 'argil', 'esmectit', 'serpentin'] },
  organics: { label: 'orgânicos', keywords: ['organ', 'orgân', 'hidrocarbon', 'betume', 'metan', 'tolin', 'querogen'] },
  aeolianSand: { label: 'areia eólica', keywords: ['areia', 'quartzo', 'duna'] },
} satisfies Record<string, MineralClass>;

const ICY_MOON: TargetProfile = {
  label: 'superfície gelada / oceano interno',
  classes: [C.ice, C.hydratedSalts, C.sulfur, C.organics],
  aw: [0.6, 1],
  pH: [6, 11],
  caveat: 'Análogos terrestres só reproduzem parcialmente crostas de gelo e oceanos internos.',
};

const AIRLESS_SILICATE: TargetProfile = {
  label: 'regolito silicatado sem atmosfera',
  classes: [C.anorthosite, C.mafic, C.ilmenite, C.impact],
  aw: [0, 0.15],
};

const PROFILES: Partial<Record<PlanetaryTarget, TargetProfile>> = {
  Mars: {
    label: 'Marte',
    classes: [C.sulfates, C.ironOxides, C.phyllosilicates, C.chlorides, C.mafic, C.carbonates, C.silica],
    aw: [0, 0.6],
    pH: [2, 9.5],
  },
  Moon: AIRLESS_SILICATE,
  Mercury: { ...AIRLESS_SILICATE, label: 'Mercúrio', classes: [...AIRLESS_SILICATE.classes, C.sulfur] },
  Phobos: { ...AIRLESS_SILICATE, label: 'Fobos', classes: [C.mafic, C.phyllosilicates, C.impact, C.ironOxides] },
  Deimos: { ...AIRLESS_SILICATE, label: 'Deimos', classes: [C.mafic, C.phyllosilicates, C.impact, C.ironOxides] },
  Venus: { label: 'Vénus', classes: [C.mafic, C.sulfur, C.sulfates, C.ironOxides], aw: [0, 0.1] },
  Io: { label: 'Io', classes: [C.mafic, C.sulfur, C.sulfates], aw: [0, 0.1] },
  Europa: ICY_MOON,
  Ganymede: ICY_MOON,
  Callisto: { ...ICY_MOON, classes: [C.ice, C.phyllosilicates, C.organics, C.hydratedSalts] },
  Mimas: ICY_MOON,
  Tethys: ICY_MOON,
  Dione: ICY_MOON,
  Rhea: ICY_MOON,
  Iapetus: { ...ICY_MOON, classes: [C.ice, C.organics] },
  Miranda: ICY_MOON,
  Ariel: ICY_MOON,
  Umbriel: ICY_MOON,
  Titania: ICY_MOON,
  Oberon: ICY_MOON,
  Triton: { ...ICY_MOON, classes: [C.ice, C.organics, C.hydratedSalts] },
  Pluto: { ...ICY_MOON, classes: [C.ice, C.organics] },
  Charon: { ...ICY_MOON, classes: [C.ice, C.ammoniated] },
  Enceladus: {
    label: 'Encélado',
    classes: [C.sodaCarbonates, C.serpentine, C.silica, C.chlorides, C.ice],
    aw: [0.8, 1],
    pH: [8.5, 12.5],
  },
  Ceres: {
    label: 'Ceres',
    classes: [C.ammoniated, C.carbonates, C.sodaCarbonates, C.chlorides, C.serpentine],
    aw: [0, 0.7],
    pH: [7, 11],
  },
  Titan: {
    label: 'Titã',
    classes: [C.organics, C.ice, C.aeolianSand],
    aw: [0, 0.3],
    caveat: 'Titã não tem água líquida à superfície; a comparação vale sobretudo para morfologia de dunas e orgânicos.',
  },
  Earth: {
    label: 'Terra (referência)',
    classes: [C.mafic, C.carbonates, C.phyllosilicates, C.sulfates, C.ironOxides, C.chlorides, C.silica],
  },
};

const NO_SURFACE: PlanetaryTarget[] = ['Jupiter', 'Saturn', 'Uranus', 'Neptune'];

function profileFor(target: PlanetaryTarget): TargetProfile | null {
  if (target === 'Both') {
    const mars = PROFILES.Mars!;
    const moon = PROFILES.Moon!;
    return {
      label: 'Marte e Lua',
      classes: [...new Set([...mars.classes, ...moon.classes])],
      aw: [0, 0.6],
    };
  }
  return PROFILES[target] ?? null;
}

const matchesClass = (mineral: string, cls: MineralClass) => {
  const m = mineral.toLowerCase();
  return cls.keywords.some((k) => m.includes(k));
};

/** 100 inside the range, falling linearly to 0 at `tolerance` outside it. */
function rangeScore(value: number, [lo, hi]: [number, number], tolerance: number): number {
  if (value >= lo && value <= hi) return 100;
  const distance = value < lo ? lo - value : value - hi;
  return Math.max(0, 100 * (1 - distance / tolerance));
}

const round1 = (v: number) => Math.round(v * 10) / 10;

export interface FidelityResult {
  mineralogy: number;
  geomorphology: number;
  geochemistry: number;
  radiation: number;
  thermal: number;
  total: number;
  coverage: number;
  notes: string[];
}

export type FidelityInput = Partial<
  Pick<GeologicalSample, 'minerals' | 'waterActivity' | 'pH' | 'depthCm' | 'porosityPercent' | 'targetPlanet' | 'unmeasured'>
>;

export function computeAnalogueFidelity(
  sample: FidelityInput,
  targetPlanet: PlanetaryTarget,
  referenceSite?: Pick<AnalogueSite, 'radarAxes' | 'name'> | null
): FidelityResult {
  const notes: string[] = [];
  const unmeasured = new Set<UnmeasuredField>(sample.unmeasured || []);
  const site = referenceSite?.radarAxes;
  const siteAxes = {
    geomorphology: site ? site.geomorphology : 0,
    radiation: site ? site.radiation : 0,
    thermal: site ? site.thermal : 0,
  };
  if (site) {
    notes.push(`Terreno, radiação e clima vêm do sítio de referência (${referenceSite!.name}) e não entram na nota da amostra.`);
  }

  if (NO_SURFACE.includes(targetPlanet)) {
    notes.push('Este planeta não tem superfície sólida: não há análogo mineral terrestre comparável.');
    return { mineralogy: 0, geochemistry: 0, ...siteAxes, total: 0, coverage: 0, notes };
  }

  const profile = profileFor(targetPlanet);
  if (!profile) {
    notes.push('Ainda não há perfil de referência para este corpo.');
    return { mineralogy: 0, geochemistry: 0, ...siteAxes, total: 0, coverage: 0, notes };
  }
  if (profile.caveat) notes.push(profile.caveat);

  // --- Mineralogy ---
  const minerals = unmeasured.has('minerals') ? {} : sample.minerals || {};
  const entries = Object.entries(minerals).filter(([, pct]) => Number.isFinite(pct) && pct > 0);
  const totalPct = entries.reduce((sum, [, pct]) => sum + pct, 0);
  let mineralogy = 0;
  let mineralogyMeasured = false;

  if (entries.length > 0 && totalPct > 0) {
    mineralogyMeasured = true;
    const matchedPct = entries
      .filter(([name]) => profile.classes.some((cls) => matchesClass(name, cls)))
      .reduce((sum, [, pct]) => sum + pct, 0);
    const matchedClasses = profile.classes.filter((cls) => entries.some(([name]) => matchesClass(name, cls)));
    const share = matchedPct / totalPct;
    const diversity = Math.min(1, matchedClasses.length / Math.min(3, profile.classes.length));
    mineralogy = 100 * (0.6 * share + 0.4 * diversity);
    notes.push(
      matchedClasses.length > 0
        ? `Minerais indicadores de ${profile.label}: ${matchedClasses.map((c) => c.label).join(', ')} (${Math.round(share * 100)}% da massa informada).`
        : `Nenhum mineral indicador de ${profile.label} entre os minerais informados.`
    );
  } else {
    notes.push('Sem minerais informados: a mineralogia não pode ser avaliada.');
  }

  // --- Geochemistry ---
  const chemParts: number[] = [];
  if (profile.aw) {
    if (!unmeasured.has('waterActivity') && Number.isFinite(sample.waterActivity)) {
      const s = rangeScore(sample.waterActivity!, profile.aw, 0.3);
      chemParts.push(s);
      notes.push(`aw ${sample.waterActivity} vs. referência ${profile.aw[0]}–${profile.aw[1]}: ${Math.round(s)}/100.`);
    } else {
      notes.push('aw não medida.');
    }
  }
  if (profile.pH) {
    if (!unmeasured.has('pH') && Number.isFinite(sample.pH)) {
      const s = rangeScore(sample.pH!, profile.pH, 3);
      chemParts.push(s);
      notes.push(`pH ${sample.pH} vs. referência ${profile.pH[0]}–${profile.pH[1]}: ${Math.round(s)}/100.`);
    } else {
      notes.push('pH não medido.');
    }
  }
  const geochemistry = chemParts.length > 0 ? chemParts.reduce((a, b) => a + b, 0) / chemParts.length : 0;

  // --- Total: only what was measured counts; missing inputs pull the score down via coverage ---
  const expectedChem = (profile.aw ? 1 : 0) + (profile.pH ? 1 : 0);
  const weights = { mineralogy: 0.6, geochemistry: expectedChem > 0 ? 0.4 : 0 };
  const weightSum = weights.mineralogy + weights.geochemistry;
  const total =
    (weights.mineralogy * mineralogy + weights.geochemistry * geochemistry * (expectedChem > 0 ? chemParts.length / expectedChem : 0)) /
    weightSum;
  const coverage = (Number(mineralogyMeasured) + chemParts.length) / (1 + expectedChem);
  if (coverage < 1) notes.push(`Dados medidos cobrem ${Math.round(coverage * 100)}% dos critérios; complete-os para uma nota fiável.`);

  return {
    mineralogy: round1(mineralogy),
    geochemistry: round1(geochemistry),
    ...siteAxes,
    total: round1(total),
    coverage: round1(coverage),
    notes,
  };
}
