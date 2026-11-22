import { getLang } from '../i18n';
import type { AnalogueSite, GeologicalSample } from '../types';

type SiteText = Pick<AnalogueSite, 'name' | 'location' | 'country' | 'geologyType' | 'planetaryCounterpart' | 'description'>;

const englishSiteText: Partial<Record<string, SiteText>> = {
  "danakil": {
    "name": "Danakil Depression & Dallol Volcano",
    "location": "Afar Region",
    "country": "Ethiopia",
    "geologyType": "Acidic hydrothermal systems with halite and sulphur evaporite crusts",
    "planetaryCounterpart": "Noachian hydrothermal deposits and Columbia Hills (Mars) / volcanic surface (Venus)",
    "description": "This extreme environment in the Afar Triangle lies 125 m below sea level. It combines boiling brines (108 °C), pH below zero, sulphurous gases and jarosite and hematite deposits. It serves as a reference for the physicochemical limits of life on early Mars."
  },
  "richat": {
    "name": "Richat Structure (Guelb er Richat)",
    "location": "Adrar Plateau",
    "country": "Mauritania",
    "geologyType": "Eroded 40 km geological dome with concentric quartzite and gabbro rings",
    "planetaryCounterpart": "Eroded circular structures and layered terrain at Gale and Jezero (Mars)",
    "description": "NASA uses this 40 km formation in Earth Observatory and Landsat work as a reference for interpreting concentric stratigraphy, hydrothermal breccias and wind erosion from orbit."
  },
  "namib": {
    "name": "Namib Sand Sea & Gravel Plains",
    "location": "Namib Desert",
    "country": "Namibia",
    "geologyType": "Giant linear dunes and desert pavements rich in iron oxides",
    "planetaryCounterpart": "Shangri-La linear dunes (Titan) and Bagnold Dune Field (Mars)",
    "description": "Scientists working on the Cassini, Dragonfly and Curiosity missions use the Namib’s linear dunes to model how wind transports sediment and shapes dunes on Titan and Mars."
  },
  "vredefort": {
    "name": "Vredefort Impact Dome",
    "location": "Free State / North West",
    "country": "South Africa",
    "geologyType": "Earth’s largest confirmed impact structure (300 km), with pseudotachylyte and shatter cones",
    "planetaryCounterpart": "South Pole–Aitken Basin and central rings of complex craters (Moon and Mars)",
    "description": "This 2.02-billion-year-old impact structure was originally about 300 km across. It preserves the deep roots of complex craters, impact melt breccias and ultra-high-pressure shock metamorphism comparable to lunar multi-ring basins."
  },
  "natron": {
    "name": "Lake Natron & East African Rift",
    "location": "Arusha Region",
    "country": "Tanzania",
    "geologyType": "Hypersaline soda lake associated with carbonatite volcanism at Ol Doinyo Lengai",
    "planetaryCounterpart": "Enceladus’s alkaline carbonate ocean (Saturn) and ancient lakes in Jezero Crater",
    "description": "This highly alkaline closed-basin lake (pH 10.5) is rich in sodium carbonate (natron) and trona. Hydrothermal springs from Earth’s only active natrocarbonatite volcano feed it. Its carbonate chemistry resembles that detected by Cassini in Enceladus’s plumes."
  },
  "atacama": {
    "name": "Atacama Desert (Salar de Pajonales & Yungay)",
    "location": "Antofagasta Region",
    "country": "Chile",
    "geologyType": "Hyperarid evaporite salt crust with halite and perchlorates",
    "planetaryCounterpart": "Jezero Crater and Meridiani Planum (Mars)",
    "description": "This site is a global reference for nonpolar hyperaridity (water activity 0.25–0.32). It contains naturally occurring perchlorates and endolithic biofilms preserved in halite."
  },
  "lanzarote": {
    "name": "Lanzarote Geopark (La Corona Lava Tube)",
    "location": "Canary Islands",
    "country": "Spain",
    "geologyType": "Collapsed basaltic lava tubes and pyroclastic fields",
    "planetaryCounterpart": "Lunar basaltic maria and lava tubes (Mare Tranquillitatis)",
    "description": "ESA’s PANGAEA geological training programme uses this area to inspect skylights and ilmenite-rich basalts in preparation for Artemis."
  },
  "borup-fiord": {
    "name": "Borup Fiord Pass (Ellesmere Island)",
    "location": "Arctic Nunavut",
    "country": "Canada",
    "geologyType": "Glacier with sulphur-rich springs and sulphur and gypsum deposits",
    "planetaryCounterpart": "Europa’s cryogenic crust (Jupiter)",
    "description": "Cold sulphur springs emerge over glacial ice. The site is a spectral calibration reference for Europa Clipper’s MISE instrument."
  }
};

const englishRegions: Partial<Record<string, string>> = {
  'África': 'Africa',
  'América do Sul': 'South America',
  Europa: 'Europe',
  'Ártico': 'Arctic',
};

export function getSiteText(site: AnalogueSite, field: keyof SiteText | 'region'): string {
  if (getLang() === 'pt') return site[field];
  if (field === 'region') return englishRegions[site.region] ?? site.region;
  return englishSiteText[site.id]?.[field] ?? site[field];
}

const englishMinerals: Partial<Record<string, string>> = {
  "basalto": "Basalt",
  "olivina": "Olivine",
  "piroxênio": "Pyroxene",
  "plagioclásio": "Plagioclase",
  "anortosito": "Anorthosite",
  "ilmenita": "Ilmenite",
  "magnetita": "Magnetite",
  "hematita": "Hematite",
  "goethita": "Goethite",
  "jarosita": "Jarosite",
  "gesso": "Gypsum",
  "anidrita": "Anhydrite",
  "halita": "Halite",
  "halita (nacl)": "Halite (NaCl)",
  "perclorato": "Perchlorate",
  "esmectita": "Smectite",
  "montmorilonita": "Montmorillonite",
  "caulinita": "Kaolinite",
  "calcita": "Calcite",
  "dolomita": "Dolomite",
  "natrão": "Natron",
  "serpentina": "Serpentine",
  "brucita": "Brucite",
  "opala": "Opal",
  "quartzo": "Quartz",
  "enxofre nativo": "Native sulphur",
  "pirita": "Pyrite",
  "gelo": "Ice",
  "matéria orgânica": "Organic matter",
  "silicatos basálticos": "Basaltic silicates",
  "quartzito": "Quartzite",
  "gabro basáltico": "Basaltic gabbro",
  "brecha hidrotermal": "Hydrothermal breccia",
  "quartzo hematítico": "Hematitic quartz",
  "feldspato": "Feldspar",
  "gesso costeiro": "Coastal gypsum",
  "quartzo chocado (pdfs)": "Shocked quartz (PDFs)",
  "pseudotaquilito": "Pseudotachylyte",
  "anortosito arqueano": "Archean anorthosite",
  "zircão chocado": "Shocked zircon",
  "termonatrita": "Thermonatrite",
  "nefelina": "Nepheline",
  "perclorato de magnésio": "Magnesium perchlorate",
  "plagioclásio labradorítico": "Labradorite plagioclase",
  "augita": "Augite",
  "ilmenita (fetio3)": "Ilmenite (FeTiO3)",
  "gelo glacial (h2o)": "Glacial ice (H2O)",
  "enxofre elementar (s8)": "Elemental sulphur (S8)",
  "mirabilita": "Mirabilite"
};

export function getMineralLabel(name: string): string {
  return getLang() === 'en' ? englishMinerals[name.toLowerCase()] ?? name : name;
}

type SampleText = Pick<GeologicalSample, 'name' | 'rockClassification' | 'fieldNotes'>;

const englishSamples: Partial<Record<string, SampleText>> = {
  "smp-dnk-01": {
    "name": "DNK-DAL-01: Highly Acidic Sulfate Crust at Dallol",
    "rockClassification": "Polymineral evaporite of halite, jarosite and sulphur",
    "fieldNotes": "Collected on an active hydrothermal terrace at the Dallol dome. Very low water activity (aw 0.24), extreme pH and chaotropic salts inhibit cell growth."
  },
  "smp-vrd-02": {
    "name": "VRD-IMP-04: Pseudotachylyte & Shocked Quartz at Vredefort",
    "rockClassification": "Impact melt breccia with planar deformation features (PDFs)",
    "fieldNotes": "A pseudotachylyte vein cuts through Archean gneiss in the inner ring of the Vredefort structure. Its shock microstructures resemble those of Apollo lunar breccias."
  },
  "smp-nat-03": {
    "name": "NAT-RIF-07: Alkaline Trona Evaporite & Carbonatite",
    "rockClassification": "Alkaline lake carbonate crust",
    "fieldNotes": "Carbonate crust precipitated along the southern shore of Lake Natron from runoff associated with Ol Doinyo Lengai. Its pH of 10.5 resembles the alkalinity of Enceladus’s ocean."
  },
  "smp-atc-04": {
    "name": "ATACAMA-PAL-04: Perchlorate-bearing Evaporite Nodule",
    "rockClassification": "Halite evaporite with an endolithic biofilm",
    "fieldNotes": "Collected 4.5 cm below the surface of the salt crust. Chroococcidiopsis cyanobacteria adapted to extreme desiccation were detected."
  },
  "smp-nam-05": {
    "name": "NAM-DUN-09: Hematitic Sand from the Namib’s Linear Dunes",
    "rockClassification": "Wind-blown quartz and iron-rich sediment",
    "fieldNotes": "A surface sample collected on a Namib linear dune crest for Cassini radar backscatter calibration and Dragonfly site selection on Titan."
  },
  "smp-dnk-06": {
    "name": "DNK-VEN-02: Acidic Hydrothermal Basalt from the Afar Triangle",
    "rockClassification": "Vesicular basalt altered by sulphurous vapours",
    "fieldNotes": "Basaltic crust exposed to dry acidic fumaroles, used in an open study to calibrate thermal emissivity for VERITAS and DAVINCI."
  }
};

export function getSampleText(sample: GeologicalSample, field: keyof SampleText | 'officialSource'): string {
  if (getLang() === 'pt' || sample.officialSource !== 'Dados de demonstração (fictícios)') return sample[field];
  if (field === 'officialSource') return 'Fictional demonstration data';
  return englishSamples[sample.id]?.[field] ?? sample[field];
}
