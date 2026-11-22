import { PlanetaryTarget } from '../types';
import { getLang } from '../i18n';

export type CelestialBodyGroup = 'planet' | 'dwarf_planet' | 'satellite';

export interface CelestialBodyOption {
  id: PlanetaryTarget;
  namePt: string;
  group: CelestialBodyGroup;
  hostBodyPt?: string;
  optionLabel: string;
  nasaQuery: string;
  featuredInQuickList?: boolean;
}

export const CELESTIAL_BODIES: CelestialBodyOption[] = [
  // Planetas do Sistema Solar
  {
    id: 'Mercury',
    namePt: 'Mercúrio',
    group: 'planet',
    optionLabel: 'Mercúrio (Planeta rochoso e crateras)',
    nasaQuery: 'Mercury planet MESSENGER surface craters',
  },
  {
    id: 'Venus',
    namePt: 'Vênus',
    group: 'planet',
    optionLabel: 'Vênus (Planeta vulcânico)',
    nasaQuery: 'Venus volcanic surface Magellan',
    featuredInQuickList: true,
  },
  {
    id: 'Earth',
    namePt: 'Terra (Referência)',
    group: 'planet',
    optionLabel: 'Terra (Referência base e calibração)',
    nasaQuery: 'Earth geology terrestrial analog NASA',
  },
  {
    id: 'Mars',
    namePt: 'Marte',
    group: 'planet',
    optionLabel: 'Marte (Planeta Vermelho)',
    nasaQuery: 'Mars geology surface Jezero',
    featuredInQuickList: true,
  },
  {
    id: 'Jupiter',
    namePt: 'Júpiter',
    group: 'planet',
    optionLabel: 'Júpiter (Gigante gasoso)',
    nasaQuery: 'Jupiter Juno atmosphere storms',
  },
  {
    id: 'Saturn',
    namePt: 'Saturno',
    group: 'planet',
    optionLabel: 'Saturno (Gigante gasoso e anéis)',
    nasaQuery: 'Saturn Cassini atmosphere rings',
  },
  {
    id: 'Uranus',
    namePt: 'Urano',
    group: 'planet',
    optionLabel: 'Urano (Gigante de gelo)',
    nasaQuery: 'Uranus ice giant Voyager',
  },
  {
    id: 'Neptune',
    namePt: 'Netuno',
    group: 'planet',
    optionLabel: 'Netuno (Gigante de gelo e ventos)',
    nasaQuery: 'Neptune ice giant Voyager',
  },

  // Planetas Anões
  {
    id: 'Ceres',
    namePt: 'Ceres',
    group: 'dwarf_planet',
    optionLabel: 'Ceres (Planeta anão · sais e criovulcanismo)',
    nasaQuery: 'Ceres Dawn Occator crater',
  },
  {
    id: 'Pluto',
    namePt: 'Plutão',
    group: 'dwarf_planet',
    optionLabel: 'Plutão (Planeta anão · geleiras de nitrogênio)',
    nasaQuery: 'Pluto New Horizons surface',
  },

  // Satélites Naturais (Luas)
  {
    id: 'Moon',
    namePt: 'Lua',
    group: 'satellite',
    hostBodyPt: 'Terra',
    optionLabel: 'Lua — Terra (Superfície e regolito lunar)',
    nasaQuery: 'Moon lunar regolith crater',
    featuredInQuickList: true,
  },
  {
    id: 'Phobos',
    namePt: 'Fobos',
    group: 'satellite',
    hostBodyPt: 'Marte',
    optionLabel: 'Fobos — Marte (Satélite escuro e poroso)',
    nasaQuery: 'Phobos Mars moon surface',
  },
  {
    id: 'Deimos',
    namePt: 'Deimos',
    group: 'satellite',
    hostBodyPt: 'Marte',
    optionLabel: 'Deimos — Marte (Satélite asteroidal)',
    nasaQuery: 'Deimos Mars moon',
  },
  {
    id: 'Io',
    namePt: 'Io',
    group: 'satellite',
    hostBodyPt: 'Júpiter',
    optionLabel: 'Io — Júpiter (Vulcanismo extremo de enxofre)',
    nasaQuery: 'Io Jupiter volcanoes Juno',
  },
  {
    id: 'Europa',
    namePt: 'Europa',
    group: 'satellite',
    hostBodyPt: 'Júpiter',
    optionLabel: 'Europa — Júpiter (Lua gelada e oceano)',
    nasaQuery: 'Europa Jupiter icy surface',
    featuredInQuickList: true,
  },
  {
    id: 'Ganymede',
    namePt: 'Ganimedes',
    group: 'satellite',
    hostBodyPt: 'Júpiter',
    optionLabel: 'Ganimedes — Júpiter (Maior lua do Sistema Solar)',
    nasaQuery: 'Ganymede Jupiter moon surface',
  },
  {
    id: 'Callisto',
    namePt: 'Calisto',
    group: 'satellite',
    hostBodyPt: 'Júpiter',
    optionLabel: 'Calisto — Júpiter (Gelo e crateras antigas)',
    nasaQuery: 'Callisto Jupiter moon craters',
  },
  {
    id: 'Mimas',
    namePt: 'Mimas',
    group: 'satellite',
    hostBodyPt: 'Saturno',
    optionLabel: 'Mimas — Saturno (Cratera Herschel e gelo)',
    nasaQuery: 'Mimas Saturn Cassini',
  },
  {
    id: 'Enceladus',
    namePt: 'Encélado',
    group: 'satellite',
    hostBodyPt: 'Saturno',
    optionLabel: 'Encélado — Saturno (Plumas e oceano alcalino)',
    nasaQuery: 'Enceladus Saturn plumes ice',
    featuredInQuickList: true,
  },
  {
    id: 'Tethys',
    namePt: 'Tétis',
    group: 'satellite',
    hostBodyPt: 'Saturno',
    optionLabel: 'Tétis — Saturno (Gelo puro e cânions)',
    nasaQuery: 'Tethys Saturn moon Cassini',
  },
  {
    id: 'Dione',
    namePt: 'Dione',
    group: 'satellite',
    hostBodyPt: 'Saturno',
    optionLabel: 'Dione — Saturno (Escarpas de gelo)',
    nasaQuery: 'Dione Saturn moon Cassini',
  },
  {
    id: 'Rhea',
    namePt: 'Reia',
    group: 'satellite',
    hostBodyPt: 'Saturno',
    optionLabel: 'Reia — Saturno (Superfície gelada craterizada)',
    nasaQuery: 'Rhea Saturn moon Cassini',
  },
  {
    id: 'Titan',
    namePt: 'Titã',
    group: 'satellite',
    hostBodyPt: 'Saturno',
    optionLabel: 'Titã — Saturno (Dunas e lagos orgânicos)',
    nasaQuery: 'Titan Saturn dunes surface',
    featuredInQuickList: true,
  },
  {
    id: 'Iapetus',
    namePt: 'Jápeto',
    group: 'satellite',
    hostBodyPt: 'Saturno',
    optionLabel: 'Jápeto — Saturno (Contraste claro/escuro e cordilheira)',
    nasaQuery: 'Iapetus Saturn moon Cassini',
  },
  {
    id: 'Miranda',
    namePt: 'Miranda',
    group: 'satellite',
    hostBodyPt: 'Urano',
    optionLabel: 'Miranda — Urano (Falésias tectônicas)',
    nasaQuery: 'Miranda Uranus moon Voyager',
  },
  {
    id: 'Ariel',
    namePt: 'Ariel',
    group: 'satellite',
    hostBodyPt: 'Urano',
    optionLabel: 'Ariel — Urano (Vales criovulcânicos)',
    nasaQuery: 'Ariel Uranus moon',
  },
  {
    id: 'Umbriel',
    namePt: 'Umbriel',
    group: 'satellite',
    hostBodyPt: 'Urano',
    optionLabel: 'Umbriel — Urano (Superfície escura de carbono/gelo)',
    nasaQuery: 'Umbriel Uranus moon',
  },
  {
    id: 'Titania',
    namePt: 'Titânia',
    group: 'satellite',
    hostBodyPt: 'Urano',
    optionLabel: 'Titânia — Urano (Maior lua de Urano)',
    nasaQuery: 'Titania Uranus moon',
  },
  {
    id: 'Oberon',
    namePt: 'Oberon',
    group: 'satellite',
    hostBodyPt: 'Urano',
    optionLabel: 'Oberon — Urano (Crateras antigas e gelo)',
    nasaQuery: 'Oberon Uranus moon',
  },
  {
    id: 'Triton',
    namePt: 'Tritão',
    group: 'satellite',
    hostBodyPt: 'Netuno',
    optionLabel: 'Tritão — Netuno (Gêiseres de nitrogênio)',
    nasaQuery: 'Triton Neptune moon geysers',
  },
  {
    id: 'Charon',
    namePt: 'Caronte',
    group: 'satellite',
    hostBodyPt: 'Plutão',
    optionLabel: 'Caronte — Plutão (Cânions e tolinas)',
    nasaQuery: 'Charon Pluto New Horizons',
  },
];

export const PLANET_BODIES = CELESTIAL_BODIES.filter((b) => b.group === 'planet');
export const DWARF_PLANET_BODIES = CELESTIAL_BODIES.filter((b) => b.group === 'dwarf_planet');
export const SATELLITE_BODIES = CELESTIAL_BODIES.filter((b) => b.group === 'satellite');

export function getCelestialBodyOption(target: PlanetaryTarget | string): CelestialBodyOption | undefined {
  return CELESTIAL_BODIES.find((b) => b.id === target);
}

// English names, kept apart so the Portuguese catalogue above stays easy to read.
const BODY_EN: Record<string, { name: string; host?: string; option: string }> = {
  Mercury: { name: 'Mercury', option: 'Mercury (rocky, cratered planet)' },
  Venus: { name: 'Venus', option: 'Venus (volcanic planet)' },
  Earth: { name: 'Earth (reference)', option: 'Earth (baseline and calibration)' },
  Mars: { name: 'Mars', option: 'Mars (the Red Planet)' },
  Jupiter: { name: 'Jupiter', option: 'Jupiter (gas giant)' },
  Saturn: { name: 'Saturn', option: 'Saturn (gas giant with rings)' },
  Uranus: { name: 'Uranus', option: 'Uranus (ice giant)' },
  Neptune: { name: 'Neptune', option: 'Neptune (ice giant and winds)' },
  Ceres: { name: 'Ceres', option: 'Ceres (dwarf planet · salts and cryovolcanism)' },
  Pluto: { name: 'Pluto', option: 'Pluto (dwarf planet · nitrogen glaciers)' },
  Moon: { name: 'Moon', host: 'Earth', option: 'Moon — Earth (lunar surface and regolith)' },
  Phobos: { name: 'Phobos', host: 'Mars', option: 'Phobos — Mars (dark, porous moon)' },
  Deimos: { name: 'Deimos', host: 'Mars', option: 'Deimos — Mars (asteroid-like moon)' },
  Io: { name: 'Io', host: 'Jupiter', option: 'Io — Jupiter (extreme sulphur volcanism)' },
  Europa: { name: 'Europa', host: 'Jupiter', option: 'Europa — Jupiter (icy moon with an ocean)' },
  Ganymede: { name: 'Ganymede', host: 'Jupiter', option: 'Ganymede — Jupiter (largest moon in the Solar System)' },
  Callisto: { name: 'Callisto', host: 'Jupiter', option: 'Callisto — Jupiter (ice and ancient craters)' },
  Mimas: { name: 'Mimas', host: 'Saturn', option: 'Mimas — Saturn (Herschel crater and ice)' },
  Enceladus: { name: 'Enceladus', host: 'Saturn', option: 'Enceladus — Saturn (plumes and alkaline ocean)' },
  Tethys: { name: 'Tethys', host: 'Saturn', option: 'Tethys — Saturn (pure ice and canyons)' },
  Dione: { name: 'Dione', host: 'Saturn', option: 'Dione — Saturn (ice cliffs)' },
  Rhea: { name: 'Rhea', host: 'Saturn', option: 'Rhea — Saturn (cratered icy surface)' },
  Titan: { name: 'Titan', host: 'Saturn', option: 'Titan — Saturn (dunes and organic lakes)' },
  Iapetus: { name: 'Iapetus', host: 'Saturn', option: 'Iapetus — Saturn (two-tone surface and ridge)' },
  Miranda: { name: 'Miranda', host: 'Uranus', option: 'Miranda — Uranus (tectonic cliffs)' },
  Ariel: { name: 'Ariel', host: 'Uranus', option: 'Ariel — Uranus (cryovolcanic valleys)' },
  Umbriel: { name: 'Umbriel', host: 'Uranus', option: 'Umbriel — Uranus (dark carbon/ice surface)' },
  Titania: { name: 'Titania', host: 'Uranus', option: 'Titania — Uranus (largest moon of Uranus)' },
  Oberon: { name: 'Oberon', host: 'Uranus', option: 'Oberon — Uranus (old craters and ice)' },
  Triton: { name: 'Triton', host: 'Neptune', option: 'Triton — Neptune (nitrogen geysers)' },
  Charon: { name: 'Charon', host: 'Pluto', option: 'Charon — Pluto (canyons and tholins)' },
};

/** Name in the current interface language. */
export function bodyName(b: CelestialBodyOption): string {
  return getLang() === 'en' ? BODY_EN[b.id]?.name || b.namePt : b.namePt;
}

/** Name plus host planet for moons, e.g. "Europa (Júpiter)". */
export function bodyFullName(b: CelestialBodyOption): string {
  const en = getLang() === 'en';
  const host = en ? BODY_EN[b.id]?.host : b.hostBodyPt;
  return host ? `${bodyName(b)} (${host})` : bodyName(b);
}

/** Descriptive label for selects. */
export function bodyOptionLabel(b: CelestialBodyOption): string {
  return getLang() === 'en' ? BODY_EN[b.id]?.option || b.optionLabel : b.optionLabel;
}

/** Every known name of a body (both languages), for matching typed text. */
export function bodyNames(b: CelestialBodyOption): string[] {
  return [b.id, b.namePt, BODY_EN[b.id]?.name].filter(Boolean) as string[];
}

const bothLabel = () => (getLang() === 'en' ? 'Mars and Moon' : 'Marte e Lua');

export function getCelestialBodyLabel(target: PlanetaryTarget | string): string {
  if (target === 'Both') return bothLabel();
  const opt = getCelestialBodyOption(target);
  return opt ? bodyName(opt) : String(target);
}

export function getCelestialBodyFullLabel(target: PlanetaryTarget | string): string {
  if (target === 'Both') return bothLabel();
  const opt = getCelestialBodyOption(target);
  return opt ? bodyFullName(opt) : String(target);
}

export function getCelestialNasaQuery(target: PlanetaryTarget | string): string {
  return getCelestialBodyOption(target)?.nasaQuery || `${target} planetary geology NASA`;
}
