import { AnalogueSite, CollaboratorProfile, DirectResearchMessage, GeologicalSample } from '../types';
import { generateDynamicAvatarSvg } from '../services/localAccountStore';
import { computeAnalogueFidelity } from '../services/analogueFidelity';
import { computeSampleFingerprint } from '../services/fingerprint';

/**
 * Demonstration profiles. They are fictional on purpose: earlier versions used real
 * researchers' names with invented bios, photos and endorsements.
 */
const DEMO_NAMES: Record<string, string> = {
  'col-cavalazzi': 'Demo · Astrobiologia de Dallol',
  'col-reimold': 'Demo · Geologia de Impacto',
  'col-juma': 'Demo · Geoquímica do Rift',
  'col-vargas': 'Demo · Hiperaridez e Espectroscopia',
  'col-mensah': 'Demo · Geomorfologia Eólica',
};

/** Names used by older builds, so data already saved in browsers can be relabelled. */
export const LEGACY_NAME_REPLACEMENTS: Record<string, string> = {
  'Dra. Belilla Cavalazzi': 'Demo · Astrobiologia de Dallol',
  'Prof. Uwe Reimold': 'Demo · Geologia de Impacto',
  'Dra. Amina Juma': 'Demo · Geoquímica do Rift',
  'Dra. Camila Vargas': 'Demo · Hiperaridez e Espectroscopia',
  'Dr. Kwame Mensah': 'Demo · Geomorfologia Eólica',
  'Dr. Felipe Gómez': 'Revisor Demo A',
  'Dr. Clive Neal': 'Revisor Demo B',
  'Dr. Christopher Glein': 'Revisor Demo C',
  'Dr. Christopher McKay': 'Revisor Demo D',
  'Dr. Ralph Lorenz': 'Revisor Demo E'
};

export const COLLABORATORS: CollaboratorProfile[] = [
  {
    id: 'col-cavalazzi',
    name: 'Demo · Astrobiologia de Dallol',
    codename: '@demo-dallol',
    avatarUrl: generateDynamicAvatarSvg(DEMO_NAMES['col-cavalazzi'].replace('Demo · ', '')),
    role: 'Astrobiologia (demo)',
    institution: 'Perfil de demonstração (fictício)',
    country: 'Etiópia',
    specialty: 'Evaporitos hiperácidos, salmouras caotrópicas e limites físico-químicos da vida',
    bio: 'Perfil fictício de demonstração — não representa nenhuma pessoa real. Tema: Evaporitos hiperácidos e salmouras de Dallol como análogos de Marte e Vénus.',
    focusPlanets: ['Mars', 'Venus'],
    openToContributions: true,
  },
  {
    id: 'col-reimold',
    name: 'Demo · Geologia de Impacto',
    codename: '@demo-vredefort',
    avatarUrl: generateDynamicAvatarSvg(DEMO_NAMES['col-reimold'].replace('Demo · ', '')),
    role: 'Geologia de impacto (demo)',
    institution: 'Perfil de demonstração (fictício)',
    country: 'África do Sul',
    specialty: 'Metamorfismo de choque, brechas de fusão e estruturas multi-anéis',
    bio: 'Perfil fictício de demonstração — não representa nenhuma pessoa real. Tema: Metamorfismo de choque em Vredefort como análogo de regolito lunar.',
    focusPlanets: ['Moon', 'Mars'],
    openToContributions: true,
  },
  {
    id: 'col-juma',
    name: 'Demo · Geoquímica do Rift',
    codename: '@demo-natron',
    avatarUrl: generateDynamicAvatarSvg(DEMO_NAMES['col-juma'].replace('Demo · ', '')),
    role: 'Geoquímica (demo)',
    institution: 'Perfil de demonstração (fictício)',
    country: 'Tanzânia',
    specialty: 'Lagos soda-alcalinos, carbonatitos e plumas oceânicas de Encélado',
    bio: 'Perfil fictício de demonstração — não representa nenhuma pessoa real. Tema: Lagos soda-alcalinos (Natron) como análogos do oceano de Encélado.',
    focusPlanets: ['Enceladus', 'Mars'],
    openToContributions: true,
  },
  {
    id: 'col-vargas',
    name: 'Demo · Hiperaridez e Espectroscopia',
    codename: '@demo-atacama',
    avatarUrl: generateDynamicAvatarSvg(DEMO_NAMES['col-vargas'].replace('Demo · ', '')),
    role: 'Espectroscopia (demo)',
    institution: 'Perfil de demonstração (fictício)',
    country: 'Chile',
    specialty: 'Percloratos naturais, biofilmes endolíticos e espectrometria SWIR',
    bio: 'Perfil fictício de demonstração — não representa nenhuma pessoa real. Tema: Hiperaridez, percloratos e espectroscopia SWIR no Atacama.',
    focusPlanets: ['Mars', 'Europa'],
    openToContributions: true,
  },
  {
    id: 'col-mensah',
    name: 'Demo · Geomorfologia Eólica',
    codename: '@demo-namibe',
    avatarUrl: generateDynamicAvatarSvg(DEMO_NAMES['col-mensah'].replace('Demo · ', '')),
    role: 'Geomorfologia eólica (demo)',
    institution: 'Perfil de demonstração (fictício)',
    country: 'Namíbia',
    specialty: 'Dunas lineares gigantes, dinâmica eólica e espectros de óxidos férricos',
    bio: 'Perfil fictício de demonstração — não representa nenhuma pessoa real. Tema: Dunas lineares do Namibe como análogos das dunas de Titã e Marte.',
    focusPlanets: ['Titan', 'Mars'],
    openToContributions: true,
  },
];

export const ANALOGUE_SITES: AnalogueSite[] = [
  {
    id: 'danakil',
    name: 'Depressão de Danakil & Vulcão Dallol',
    targetPlanet: 'Mars',
    location: 'Região de Afar',
    country: 'Etiópia',
    region: 'África',
    coordinates: [14.2417, 40.2983],
    elevationMeters: -125,
    geologyType: 'Sistemas hidrotermais hiperácidos, crostas evaporíticas de halita e enxofre',
    planetaryCounterpart: 'Depósitos Hidrotermais Noachianos e Columbia Hills (Marte) / Superfície Vulcânica (Vênus)',
    fidelityScore: 94.8,
    description: 'Ambiente poliestremo africano situado a 125 m abaixo do nível do mar no Triângulo de Afar. Combina salmouras ferventes (108 °C), pH < 0, gases sulfurosos e depósitos de jarosita/hematita — referência oficial para limites físico-químicos da vida em Marte primitivo.',
    primaryMinerals: ['Halita (NaCl)', 'Enxofre Nativo', 'Jarosita', 'Gesso', 'Anidrita', 'Silicatos Basálticos'],
    atmosphericPressureMbar: 1025,
    uvRadiationWm2: 72.4,
    waterActivityAw: 0.24,
    analogousFeatures: [
      'Precipitação simultânea de sulfatos de ferro (jarosita) e halita em fluidos ácidos',
      'Ausência de atividade biológica celular em zonas de saturação caotrópica de MgCl2',
      'Basaltos rifting análogos ao vulcanismo extensional planetário'
    ],
    nasaInstrumentsTested: ['Espectrômetro Raman Portátil', 'XRF Mineralógico', 'Sondas Térmicas de Baixo pH'],
    scientificPapersCount: 312,
    dataSource: 'Literatura científica (Cavalazzi B. et al. 2019) · altitude SRTM',
    references: [
      { citation: 'Cavalazzi B. et al. (2019). The Dallol Geothermal Area, Northern Afar (Ethiopia) — An Exceptional Planetary Field Analog on Earth. Astrobiology.', doi: '10.1089/ast.2018.1926', url: 'https://doi.org/10.1089/ast.2018.1926' },
      { citation: 'Kotopoulou E. et al. (2018). A Polyextreme Hydrothermal System Controlled by Iron: The Case of Dallol at the Afar Triangle. ACS Earth and Space Chemistry.', doi: '10.1021/acsearthspacechem.8b00141', url: 'https://doi.org/10.1021/acsearthspacechem.8b00141' },
    ],
    radarAxes: {
      mineralogy: 95,
      geomorphology: 91,
      geochemistry: 98,
      radiation: 84,
      thermal: 96
    },
    sampleSpectralCurve: [
      { wavelengthNm: 400, reflectance: 0.08 },
      { wavelengthNm: 550, reflectance: 0.24 },
      { wavelengthNm: 700, reflectance: 0.42 },
      { wavelengthNm: 850, reflectance: 0.48 },
      { wavelengthNm: 1000, reflectance: 0.45 },
      { wavelengthNm: 1400, reflectance: 0.35 },
      { wavelengthNm: 2200, reflectance: 0.31 },
      { wavelengthNm: 2500, reflectance: 0.39 }
    ]
  },
  {
    id: 'richat',
    name: 'Estrutura de Richat (Guelb er Richat)',
    targetPlanet: 'Mars',
    location: 'Planalto de Adrar',
    country: 'Mauritânia',
    region: 'África',
    coordinates: [21.124, -11.402],
    elevationMeters: 410,
    geologyType: 'Domo geológico erodido de 40 km com anéis concêntricos de quartzito e gabro',
    planetaryCounterpart: 'Estruturas Circulares Erodidas & Terrenos Estratificados de Gale / Jezero (Marte)',
    fidelityScore: 91.5,
    description: 'Formação geológica africana de 40 km de diâmetro amplamente utilizada pela NASA (Earth Observatory / Landsat) para calibração orbital de estratigrafia concêntrica, brechas hidrotermais e mapeamento de erosão eólica em Marte.',
    primaryMinerals: ['Quartzito', 'Dolomita', 'Gabro Basáltico', 'Brecha Hidrotermal', 'Hematita'],
    atmosphericPressureMbar: 965,
    uvRadiationWm2: 64.2,
    waterActivityAw: 0.31,
    analogousFeatures: [
      'Exposição contínua de camadas sedimentares e intrusivas em escala orbital (40 km)',
      'Alteração hidrotermal de sílica e carbonatos semelhante aos anéis de crateras erodidas',
      'Deflação eólica intensa em ambiente desértico hiperárido do Saara Ocidental'
    ],
    nasaInstrumentsTested: ['Landsat 8/9 OLI Calibration', 'ASTER Thermal Infrared', 'ISS Crew Earth Observations'],
    scientificPapersCount: 194,
    dataSource: 'Literatura científica (Matton G. et al. 2005) · altitude SRTM',
    references: [
      { citation: 'Matton G. et al. (2005). Resolving the Richat enigma: Doming and hydrothermal karstification above an alkaline complex. Geology.', doi: '10.1130/G21542AR.1', url: 'https://doi.org/10.1130/G21542AR.1' },
    ],
    radarAxes: {
      mineralogy: 90,
      geomorphology: 97,
      geochemistry: 88,
      radiation: 86,
      thermal: 89
    },
    sampleSpectralCurve: [
      { wavelengthNm: 400, reflectance: 0.14 },
      { wavelengthNm: 550, reflectance: 0.25 },
      { wavelengthNm: 700, reflectance: 0.36 },
      { wavelengthNm: 850, reflectance: 0.42 },
      { wavelengthNm: 1300, reflectance: 0.46 },
      { wavelengthNm: 1900, reflectance: 0.38 },
      { wavelengthNm: 2200, reflectance: 0.34 },
      { wavelengthNm: 2500, reflectance: 0.41 }
    ]
  },
  {
    id: 'namib',
    name: 'Mar de Areia do Namibe & Planícies de Cascalho',
    targetPlanet: 'Titan',
    location: 'Deserto do Namibe',
    country: 'Namíbia',
    region: 'África',
    coordinates: [-24.75, 15.28],
    elevationMeters: 320,
    geologyType: 'Dunas lineares gigantes e pavimentos desérticos ricos em óxidos de ferro',
    planetaryCounterpart: 'Dunas Lineares de Shangri-La (Titã) & Campos Eólicos de Bagnold (Marte)',
    fidelityScore: 93.4,
    description: 'As dunas lineares do Namibe são o análogo geomorfológico oficial utilizado pelos cientistas das missões Cassini/Dragonfly (Titã) e Curiosity (Marte) para modelar o transporte eólico de sedimentos e interação duna-vento.',
    primaryMinerals: ['Quartzo Hematítico', 'Magnetita', 'Ilmenita', 'Feldspato', 'Gesso Costeiro'],
    atmosphericPressureMbar: 975,
    uvRadiationWm2: 66.0,
    waterActivityAw: 0.29,
    analogousFeatures: [
      'Morfologia de dunas lineares idêntica às observadas pelo radar da Cassini em Titã',
      'Grãos de quartzo revestidos por óxido férrico reproduzindo o albedo marciano',
      'Transição nítida entre ergs móveis e pavimentos basálticos'
    ],
    nasaInstrumentsTested: ['Cassini Radar Morphological Calibration', 'HiRISE Aeolian Ripple Study'],
    scientificPapersCount: 276,
    dataSource: 'Literatura científica (Lorenz R. D. et al. 2006) · altitude SRTM',
    references: [
      { citation: 'Lorenz R. D. et al. (2006). The Sand Seas of Titan: Cassini RADAR Observations of Longitudinal Dunes. Science.', doi: '10.1126/science.1123257', url: 'https://doi.org/10.1126/science.1123257' },
    ],
    radarAxes: {
      mineralogy: 89,
      geomorphology: 99,
      geochemistry: 85,
      radiation: 87,
      thermal: 88
    },
    sampleSpectralCurve: [
      { wavelengthNm: 400, reflectance: 0.10 },
      { wavelengthNm: 550, reflectance: 0.21 },
      { wavelengthNm: 700, reflectance: 0.39 },
      { wavelengthNm: 850, reflectance: 0.45 },
      { wavelengthNm: 1400, reflectance: 0.41 },
      { wavelengthNm: 1900, reflectance: 0.39 },
      { wavelengthNm: 2200, reflectance: 0.37 },
      { wavelengthNm: 2500, reflectance: 0.43 }
    ]
  },
  {
    id: 'vredefort',
    name: 'Domo de Impacto de Vredefort',
    targetPlanet: 'Moon',
    location: 'Estado Livre / Noroeste',
    country: 'África do Sul',
    region: 'África',
    coordinates: [-27.0, 27.5],
    elevationMeters: 1420,
    geologyType: 'Maior estrutura de impacto verificada da Terra (300 km), com pseudotaquilito e cones de estilhaçamento',
    planetaryCounterpart: 'Bacia Polo Sul-Aitken & Anéis Centrais de Crateras Complexas (Lua e Marte)',
    fidelityScore: 95.1,
    description: 'Estrutura de impacto de 2.02 bilhões de anos com ~300 km de diâmetro original. Preserva raízes profundas de crateras complexas, brechas de fusão por impacto e metamorfismo de choque de ultra-alta pressão análogo às bacias lunares multi-anéis.',
    primaryMinerals: ['Quartzo Chocado (PDFs)', 'Pseudotaquilito', 'Anortosito Arqueano', 'Piroxênio', 'Zircão Chocado'],
    atmosphericPressureMbar: 860,
    uvRadiationWm2: 58.0,
    waterActivityAw: 0.54,
    analogousFeatures: [
      'Cones de estilhaçamento (shatter cones) e feições de deformação planar em quartzo',
      'Exposição do embasamento cristalino arqueano soerguido por rebote central',
      'Modelagem de fusão cortical aplicável às bacias Mare Imbrium e Polo Sul-Aitken'
    ],
    nasaInstrumentsTested: ['LROC Impact Melt Mapping', 'Lunar Sample Return Breccia Benchmarking'],
    scientificPapersCount: 418,
    dataSource: 'Literatura científica (Reimold W. U. & Gibson R. L. 1996) · altitude SRTM',
    references: [
      { citation: 'Reimold W. U. & Gibson R. L. (1996). Geology and evolution of the Vredefort impact structure, South Africa. Journal of African Earth Sciences.', doi: '10.1016/S0899-5362(96)00059-0', url: 'https://doi.org/10.1016/S0899-5362(96)00059-0' },
    ],
    radarAxes: {
      mineralogy: 96,
      geomorphology: 98,
      geochemistry: 92,
      radiation: 68,
      thermal: 82
    },
    sampleSpectralCurve: [
      { wavelengthNm: 400, reflectance: 0.13 },
      { wavelengthNm: 550, reflectance: 0.19 },
      { wavelengthNm: 700, reflectance: 0.24 },
      { wavelengthNm: 1000, reflectance: 0.27 },
      { wavelengthNm: 1300, reflectance: 0.29 },
      { wavelengthNm: 2000, reflectance: 0.24 },
      { wavelengthNm: 2500, reflectance: 0.30 }
    ]
  },
  {
    id: 'natron',
    name: 'Lago Natron & Rift da África Oriental',
    targetPlanet: 'Enceladus',
    location: 'Região de Arusha',
    country: 'Tanzânia',
    region: 'África',
    coordinates: [-2.416, 36.0],
    elevationMeters: 610,
    geologyType: 'Lago hipersalino soda-alcalino associado a vulcanismo carbonatítico (Ol Doinyo Lengai)',
    planetaryCounterpart: 'Oceano Alcalino Carbonatado de Encélado (Saturno) & Paleolagos de Cratera Jezero',
    fidelityScore: 92.6,
    description: 'Lago endorreico altamente alcalino (pH 10.5) rico em carbonato de sódio (natrão) e trona, alimentado por fontes hidrotermais do único vulcão natrocarbonatítico ativo da Terra. Reproduz a química carbonatada detectada pela Cassini nas plumas de Encélado.',
    primaryMinerals: ['Trona', 'Natrão', 'Termonatrita', 'Calcita', 'Nefelina'],
    atmosphericPressureMbar: 940,
    uvRadiationWm2: 63.0,
    waterActivityAw: 0.72,
    analogousFeatures: [
      'Química aquosa dominada por carbonatos e bicarbonatos de sódio em pH > 10',
      'Preservação de bioassinaturas haloalcalifílicas em crostas minerais precipitadas',
      'Interação direta entre vulcanismo carbonatítico e bacias lacustres fechadas'
    ],
    nasaInstrumentsTested: ['Cassini INMS Analogue Brine Calibration', 'SHERLOC Raman Carbonate Detection'],
    scientificPapersCount: 235,
    dataSource: 'Literatura científica (Glein C. R. et al. 2015) · altitude SRTM',
    references: [
      { citation: 'Glein C. R. et al. (2015). The pH of Enceladus\' ocean. Geochimica et Cosmochimica Acta.', doi: '10.1016/j.gca.2015.04.017', url: 'https://doi.org/10.1016/j.gca.2015.04.017' },
    ],
    radarAxes: {
      mineralogy: 93,
      geomorphology: 89,
      geochemistry: 97,
      radiation: 71,
      thermal: 86
    },
    sampleSpectralCurve: [
      { wavelengthNm: 400, reflectance: 0.19 },
      { wavelengthNm: 550, reflectance: 0.31 },
      { wavelengthNm: 700, reflectance: 0.38 },
      { wavelengthNm: 1400, reflectance: 0.24 },
      { wavelengthNm: 1900, reflectance: 0.17 },
      { wavelengthNm: 2330, reflectance: 0.21 },
      { wavelengthNm: 2500, reflectance: 0.29 }
    ]
  },
  {
    id: 'atacama',
    name: 'Deserto do Atacama (Salar de Pajonales & Yungay)',
    targetPlanet: 'Mars',
    location: 'Região de Antofagasta',
    country: 'Chile',
    region: 'América do Sul',
    coordinates: [-24.089, -69.873],
    elevationMeters: 2450,
    geologyType: 'Crosta salina evaporítica hiperárida com halita e percloratos',
    planetaryCounterpart: 'Cratera Jezero e Planícies de Meridiani Planum (Marte)',
    fidelityScore: 94.2,
    description: 'Referência global de hiperaridez não-polar (aw 0.25–0.32). Contém percloratos naturais e biofilmes endolíticos preservados em halita.',
    primaryMinerals: ['Halita', 'Gesso', 'Anidrita', 'Hematita', 'Perclorato de Magnésio'],
    atmosphericPressureMbar: 760,
    uvRadiationWm2: 68.4,
    waterActivityAw: 0.28,
    analogousFeatures: [
      'Presença natural de percloratos e cloratos equivalentes aos medidos pela Phoenix',
      'Micro-habitats endolíticos no interior de cristais salinos translúcidos'
    ],
    nasaInstrumentsTested: ['SuperCam LIBS', 'PIXL XRF', 'SHERLOC UV Raman'],
    scientificPapersCount: 420,
    dataSource: 'Literatura científica (Navarro-González R. et al. 2003) · altitude SRTM',
    references: [
      { citation: 'Navarro-González R. et al. (2003). Mars-Like Soils in the Atacama Desert, Chile, and the Dry Limit of Microbial Life. Science.', doi: '10.1126/science.1089143', url: 'https://doi.org/10.1126/science.1089143' },
    ],
    radarAxes: {
      mineralogy: 95,
      geomorphology: 92,
      geochemistry: 96,
      radiation: 89,
      thermal: 86
    },
    sampleSpectralCurve: [
      { wavelengthNm: 400, reflectance: 0.12 },
      { wavelengthNm: 550, reflectance: 0.22 },
      { wavelengthNm: 700, reflectance: 0.38 },
      { wavelengthNm: 850, reflectance: 0.44 },
      { wavelengthNm: 1400, reflectance: 0.32 },
      { wavelengthNm: 1900, reflectance: 0.28 },
      { wavelengthNm: 2200, reflectance: 0.30 },
      { wavelengthNm: 2500, reflectance: 0.39 }
    ]
  },
  {
    id: 'lanzarote',
    name: 'Geopark de Lanzarote (Tubo de Lava de La Corona)',
    targetPlanet: 'Moon',
    location: 'Ilhas Canárias',
    country: 'Espanha',
    region: 'Europa',
    coordinates: [29.035, -13.633],
    elevationMeters: 450,
    geologyType: 'Tubos de lava basáltica colapsados e campos piroclásticos',
    planetaryCounterpart: 'Mares Basálticos e Tubos de Lava Lunares (Mare Tranquillitatis)',
    fidelityScore: 90.8,
    description: 'Área de treinamento geológico PANGAEA (ESA/NASA Artemis) para inspeção de clarabóias e basaltos ricos em ilmenita.',
    primaryMinerals: ['Plagioclásio Labradorítico', 'Augita', 'Olivina', 'Ilmenita (FeTiO3)'],
    atmosphericPressureMbar: 980,
    uvRadiationWm2: 44.0,
    waterActivityAw: 0.62,
    analogousFeatures: [
      'Clarabóias e tubos vulcânicos estruturalmente análogos aos detectados pelo LRO',
      'Basaltos com elevado teor de titânio (TiO2) semelhantes às amostras Apollo'
    ],
    nasaInstrumentsTested: ['LROC Ground-Truth', 'Portable Planetary XRF', 'LiDAR 3D'],
    scientificPapersCount: 280,
    dataSource: 'Literatura científica (Sauro F. et al. 2020) · altitude SRTM',
    references: [
      { citation: 'Sauro F. et al. (2020). Lava tubes on Earth, Moon and Mars: A review on their size and morphology revealed by comparative planetology. Earth-Science Reviews.', doi: '10.1016/j.earscirev.2020.103288', url: 'https://doi.org/10.1016/j.earscirev.2020.103288' },
    ],
    radarAxes: {
      mineralogy: 93,
      geomorphology: 96,
      geochemistry: 89,
      radiation: 65,
      thermal: 80
    },
    sampleSpectralCurve: [
      { wavelengthNm: 400, reflectance: 0.08 },
      { wavelengthNm: 550, reflectance: 0.11 },
      { wavelengthNm: 700, reflectance: 0.14 },
      { wavelengthNm: 1050, reflectance: 0.09 },
      { wavelengthNm: 1600, reflectance: 0.21 },
      { wavelengthNm: 2000, reflectance: 0.15 },
      { wavelengthNm: 2500, reflectance: 0.25 }
    ]
  },
  {
    id: 'borup-fiord',
    name: 'Borup Fiord Pass (Ilha Ellesmere)',
    targetPlanet: 'Europa',
    location: 'Nunavut Ártico',
    country: 'Canadá',
    region: 'Ártico',
    coordinates: [81.083, -81.917],
    elevationMeters: 210,
    geologyType: 'Geleira com surgência sulfurosa e precipitação de enxofre e gesso',
    planetaryCounterpart: 'Crosta Criogênica de Europa (Júpiter)',
    fidelityScore: 93.5,
    description: 'Nascentes criogênicas sulfurosas emergindo sobre gelo glacial. Benchmark oficial de calibração espectral para a missão Europa Clipper (MISE).',
    primaryMinerals: ['Gelo Glacial (H2O)', 'Enxofre Elementar (S8)', 'Gesso', 'Mirabilita'],
    atmosphericPressureMbar: 1005,
    uvRadiationWm2: 28.0,
    waterActivityAw: 0.42,
    analogousFeatures: [
      'Depósitos de enxofre e sais de sulfato hidratados sobre matriz glacial pura',
      'Fraturas de gelo com surgência salina contínua'
    ],
    nasaInstrumentsTested: ['Europa Clipper MISE Testbed', 'Cryo-Drill Probe'],
    scientificPapersCount: 165,
    dataSource: 'Literatura científica (Gleeson D. F. et al. 2012) · altitude SRTM',
    references: [
      { citation: 'Gleeson D. F. et al. (2012). Biosignature Detection at an Arctic Analog to Europa. Astrobiology.', doi: '10.1089/ast.2010.0579', url: 'https://doi.org/10.1089/ast.2010.0579' },
    ],
    radarAxes: {
      mineralogy: 96,
      geomorphology: 94,
      geochemistry: 97,
      radiation: 70,
      thermal: 98
    },
    sampleSpectralCurve: [
      { wavelengthNm: 400, reflectance: 0.22 },
      { wavelengthNm: 550, reflectance: 0.45 },
      { wavelengthNm: 700, reflectance: 0.65 },
      { wavelengthNm: 1500, reflectance: 0.25 },
      { wavelengthNm: 2000, reflectance: 0.12 },
      { wavelengthNm: 2500, reflectance: 0.38 }
    ]
  }
];

const RAW_INITIAL_SAMPLES: Omit<GeologicalSample, 'hash'>[] = [
  {
    id: 'smp-dnk-01',
    name: 'DNK-DAL-01: Crosta Sulfatada Hiperácida de Dallol',
    siteId: 'danakil',
    collaboratorId: 'col-cavalazzi',
    collectorName: 'Demo · Astrobiologia de Dallol',
    institution: 'Perfil de demonstração (fictício)',
    collectedAt: '2026-03-22',
    coordinates: [14.2417, 40.2983],
    depthCm: 2.5,
    rockClassification: 'Evaporito Polimineral de Halita, Jarosita e Enxofre',
    targetPlanet: 'Mars',
    waterActivity: 0.24,
    pH: 0.8,
    porosityPercent: 18.2,
    minerals: {
      'Halita (NaCl)': 54.0,
      'Jarosita (KFe3(SO4)2(OH)6)': 22.5,
      'Gesso (CaSO4·2H2O)': 14.0,
      'Enxofre Nativo (S8)': 6.5,
      'Hematita': 3.0
    },
    xrfComposition: {
      'Cl': 32.8,
      'Na2O': 28.4,
      'SO3': 18.6,
      'Fe2O3': 12.2,
      'CaO': 5.1,
      'K2O': 2.9
    },
    fidelityScores: {
      mineralogy: 96,
      geomorphology: 92,
      geochemistry: 99,
      radiation: 85,
      thermal: 95,
      total: 94.8
    },
    spectralCurve: [
      { wavelengthNm: 400, reflectance: 0.08 },
      { wavelengthNm: 550, reflectance: 0.24 },
      { wavelengthNm: 700, reflectance: 0.42 },
      { wavelengthNm: 850, reflectance: 0.48 },
      { wavelengthNm: 1400, reflectance: 0.35 },
      { wavelengthNm: 2200, reflectance: 0.31 },
      { wavelengthNm: 2500, reflectance: 0.39 }
    ],
    fieldNotes: 'Amostra coletada em terraço hidrotermal ativo no domo de Dallol. Baixíssima atividade de água (aw 0.24) combinada com pH extremo e sais caotrópicos inibe proliferação celular.',
    version: 'v1.4.0-pds',
    status: 'under_review',
    officialSource: 'Dados de demonstração (fictícios)',
    peerComments: [
      {
        id: 'c-dnk-01',
        sampleId: 'smp-dnk-01',
        author: 'Revisor Demo A',
        role: 'Investigador Principal',
        institution: 'Perfil de demonstração (fictício)',
        timestamp: '2026-04-02 11:15 UTC',
        content: 'Confirmação de ausência de biomarcadores ativos nos domos hipersalinos de MgCl2; excelente controle negativo para validação de detecção de vida em Marte.',
        statusChange: 'approved'
      }
    ]
  },
  {
    id: 'smp-vrd-02',
    name: 'VRD-IMP-04: Pseudotaquilito & Quartzo Chocado de Vredefort',
    siteId: 'vredefort',
    collaboratorId: 'col-reimold',
    collectorName: 'Demo · Geologia de Impacto',
    institution: 'Perfil de demonstração (fictício)',
    collectedAt: '2026-02-11',
    coordinates: [-27.014, 27.492],
    depthCm: 10.0,
    rockClassification: 'Brecha de Fusão por Impacto com Feições Planares (PDF)',
    targetPlanet: 'Moon',
    waterActivity: 0.52,
    pH: 7.6,
    porosityPercent: 11.4,
    minerals: {
      'Plagioclásio Anortítico': 41.0,
      'Quartzo com PDFs': 31.5,
      'Piroxênio': 16.5,
      'Vidro de Fusão (Pseudotaquilito)': 11.0
    },
    xrfComposition: {
      'SiO2': 61.2,
      'Al2O3': 16.4,
      'FeO': 7.8,
      'CaO': 6.9,
      'MgO': 4.5,
      'TiO2': 1.2
    },
    fidelityScores: {
      mineralogy: 95,
      geomorphology: 98,
      geochemistry: 92,
      radiation: 68,
      thermal: 82,
      total: 93.4
    },
    spectralCurve: [
      { wavelengthNm: 400, reflectance: 0.13 },
      { wavelengthNm: 550, reflectance: 0.19 },
      { wavelengthNm: 700, reflectance: 0.24 },
      { wavelengthNm: 1000, reflectance: 0.27 },
      { wavelengthNm: 2000, reflectance: 0.24 },
      { wavelengthNm: 2500, reflectance: 0.30 }
    ],
    fieldNotes: 'Veio de pseudotaquilito cortando gnaisse arqueano no anel interno da estrutura de Vredefort. Microestrutura de choque equivalente às brechas lunares das missões Apollo.',
    version: 'v1.2.0-pds',
    status: 'under_review',
    officialSource: 'Dados de demonstração (fictícios)',
    peerComments: [
      {
        id: 'c-vrd-01',
        sampleId: 'smp-vrd-02',
        author: 'Revisor Demo B',
        role: 'Cientista Lunar',
        institution: 'Perfil de demonstração (fictício)',
        timestamp: '2026-02-19 16:40 UTC',
        content: 'Textura de vidro de impacto calibrada contra amostras de Fra Mauro (Apollo 14). Referência sólida para treinamento geológico Artemis.',
        statusChange: 'approved'
      }
    ]
  },
  {
    id: 'smp-nat-03',
    name: 'NAT-RIF-07: Evaporito Alcalino de Trona & Carbonatito',
    siteId: 'natron',
    collaboratorId: 'col-juma',
    collectorName: 'Demo · Geoquímica do Rift',
    institution: 'Perfil de demonstração (fictício)',
    collectedAt: '2026-04-18',
    coordinates: [-2.418, 36.012],
    depthCm: 3.0,
    rockClassification: 'Crosta Lacustre Alcalina Carbonatada',
    targetPlanet: 'Enceladus',
    waterActivity: 0.72,
    pH: 10.5,
    porosityPercent: 29.0,
    minerals: {
      'Trona (Na3(CO3)(HCO3)·2H2O)': 58.0,
      'Natrão': 22.0,
      'Calcita': 12.5,
      'Nefelina Vulcânica': 7.5
    },
    xrfComposition: {
      'Na2O': 39.4,
      'CO2': 34.8,
      'CaO': 12.1,
      'SiO2': 8.2,
      'Al2O3': 3.5
    },
    fidelityScores: {
      mineralogy: 93,
      geomorphology: 89,
      geochemistry: 97,
      radiation: 71,
      thermal: 86,
      total: 92.6
    },
    spectralCurve: [
      { wavelengthNm: 400, reflectance: 0.19 },
      { wavelengthNm: 550, reflectance: 0.31 },
      { wavelengthNm: 700, reflectance: 0.38 },
      { wavelengthNm: 1400, reflectance: 0.24 },
      { wavelengthNm: 1900, reflectance: 0.17 },
      { wavelengthNm: 2330, reflectance: 0.21 },
      { wavelengthNm: 2500, reflectance: 0.29 }
    ],
    fieldNotes: 'Crosta carbonatada precipitada na margem sul do Lago Natron com efluente do Ol Doinyo Lengai. pH 10.5 replica a alcalinidade do oceano de Encélado.',
    version: 'v1.1.0-pds',
    status: 'under_review',
    officialSource: 'Dados de demonstração (fictícios)',
    peerComments: [
      {
        id: 'c-nat-01',
        sampleId: 'smp-nat-03',
        author: 'Revisor Demo C',
        role: 'Geoquímico Planetário',
        institution: 'Perfil de demonstração (fictício)',
        timestamp: '2026-04-25 14:20 UTC',
        content: 'Razão carbonato/bicarbonato alinhada aos modelos termodinâmicos da pluma medida pela sonda Cassini.',
        statusChange: 'approved'
      }
    ]
  },
  {
    id: 'smp-atc-04',
    name: 'ATACAMA-PAL-04: Nódulo Evaporítico com Percloratos',
    siteId: 'atacama',
    collaboratorId: 'col-vargas',
    collectorName: 'Demo · Hiperaridez e Espectroscopia',
    institution: 'Perfil de demonstração (fictício)',
    collectedAt: '2026-03-14',
    coordinates: [-24.092, -69.869],
    depthCm: 4.5,
    rockClassification: 'Evaporito de Halita com biofilme endolítico',
    targetPlanet: 'Mars',
    waterActivity: 0.27,
    pH: 7.2,
    porosityPercent: 14.8,
    minerals: {
      'Halita (NaCl)': 68.4,
      'Gesso (CaSO4·2H2O)': 18.2,
      'Anidrita (CaSO4)': 7.1,
      'Hematita (Fe2O3)': 3.8,
      'Perclorato de Magnésio': 1.6,
      'Quartzo Detrítico': 0.9
    },
    xrfComposition: {
      'Cl': 41.5,
      'Na2O': 36.2,
      'SO3': 11.4,
      'CaO': 6.2,
      'Fe2O3': 3.1,
      'MgO': 1.1,
      'SiO2': 0.5
    },
    fidelityScores: {
      mineralogy: 96,
      geomorphology: 93,
      geochemistry: 98,
      radiation: 91,
      thermal: 87,
      total: 94.6
    },
    spectralCurve: [
      { wavelengthNm: 400, reflectance: 0.15 },
      { wavelengthNm: 550, reflectance: 0.25 },
      { wavelengthNm: 700, reflectance: 0.41 },
      { wavelengthNm: 850, reflectance: 0.46 },
      { wavelengthNm: 1400, reflectance: 0.31 },
      { wavelengthNm: 1900, reflectance: 0.26 },
      { wavelengthNm: 2200, reflectance: 0.29 },
      { wavelengthNm: 2500, reflectance: 0.40 }
    ],
    fieldNotes: 'Coletada no interior da crosta salina a 4.5 cm. Detecção de cianobactérias Chroococcidiopsis adaptadas a dessecação extrema.',
    version: 'v1.2.0-pds',
    status: 'under_review',
    officialSource: 'Dados de demonstração (fictícios)',
    peerComments: [
      {
        id: 'c-atc-01',
        sampleId: 'smp-atc-04',
        author: 'Revisor Demo D',
        role: 'Investigador Principal',
        institution: 'Perfil de demonstração (fictício)',
        timestamp: '2026-03-20 14:10 UTC',
        content: 'Retenção de água higroscópica pela halita a aw 0.27 valida modelos de salmouras transientes em Marte.',
        statusChange: 'approved'
      }
    ]
  },
  {
    id: 'smp-nam-05',
    name: 'NAM-DUN-09: Areia Hematítica de Dunas Lineares do Namibe',
    siteId: 'namib',
    collaboratorId: 'col-mensah',
    collectorName: 'Demo · Geomorfologia Eólica',
    institution: 'Perfil de demonstração (fictício)',
    collectedAt: '2026-04-28',
    coordinates: [-24.752, 15.284],
    depthCm: 1.5,
    rockClassification: 'Sedimento Eólico Quartzo-Ferroso',
    targetPlanet: 'Titan',
    waterActivity: 0.29,
    pH: 6.8,
    porosityPercent: 34.5,
    minerals: {
      'Quartzo Hematítico': 72.0,
      'Magnetita': 11.5,
      'Ilmenita': 8.5,
      'Feldspato': 5.5,
      'Gesso Costeiro': 2.5
    },
    xrfComposition: {
      'SiO2': 78.4,
      'Fe2O3': 11.2,
      'Al2O3': 4.8,
      'TiO2': 2.9,
      'CaO': 1.6
    },
    fidelityScores: {
      mineralogy: 89,
      geomorphology: 99,
      geochemistry: 85,
      radiation: 87,
      thermal: 88,
      total: 93.4
    },
    spectralCurve: [
      { wavelengthNm: 400, reflectance: 0.10 },
      { wavelengthNm: 550, reflectance: 0.21 },
      { wavelengthNm: 700, reflectance: 0.39 },
      { wavelengthNm: 850, reflectance: 0.45 },
      { wavelengthNm: 1400, reflectance: 0.41 },
      { wavelengthNm: 2200, reflectance: 0.37 },
      { wavelengthNm: 2500, reflectance: 0.43 }
    ],
    fieldNotes: 'Amostra superficial coletada na crista de duna linear no Namibe para calibração de retroespalhamento de radar Cassini e seleção de sítios Dragonfly em Titã.',
    version: 'v1.0.0-pds',
    status: 'under_review',
    officialSource: 'Dados de demonstração (fictícios)',
    peerComments: [
      {
        id: 'c-nam-01',
        sampleId: 'smp-nam-05',
        author: 'Revisor Demo E',
        role: 'Cientista Planetário',
        institution: 'Perfil de demonstração (fictício)',
        timestamp: '2026-05-03 09:30 UTC',
        content: 'Espaçamento inter-dunar e granulometria consistentes com os campos eólicos equatoriais de Shangri-La em Titã.',
        statusChange: 'approved'
      }
    ]
  },
  {
    id: 'smp-dnk-06',
    name: 'DNK-VEN-02: Basalto Hidrotermal Ácido do Triângulo de Afar',
    siteId: 'danakil',
    collaboratorId: 'col-cavalazzi',
    collectorName: 'Demo · Astrobiologia de Dallol',
    institution: 'Perfil de demonstração (fictício)',
    collectedAt: '2026-05-01',
    coordinates: [14.239, 40.301],
    depthCm: 6.0,
    rockClassification: 'Basalto Vesicular Alterado por Vapores Sulfurosos',
    targetPlanet: 'Venus',
    waterActivity: 0.18,
    pH: 1.4,
    porosityPercent: 22.0,
    minerals: {
      'Basalto Alterado': 56.0,
      'Anidrita': 19.5,
      'Enxofre Nativo': 14.0,
      'Hematita': 10.5
    },
    xrfComposition: {
      'SiO2': 44.2,
      'Fe2O3': 18.8,
      'SO3': 16.4,
      'CaO': 10.1,
      'Al2O3': 8.5
    },
    fidelityScores: {
      mineralogy: 92,
      geomorphology: 90,
      geochemistry: 95,
      radiation: 80,
      thermal: 94,
      total: 91.2
    },
    spectralCurve: [
      { wavelengthNm: 400, reflectance: 0.09 },
      { wavelengthNm: 550, reflectance: 0.18 },
      { wavelengthNm: 700, reflectance: 0.31 },
      { wavelengthNm: 1400, reflectance: 0.28 },
      { wavelengthNm: 2200, reflectance: 0.26 },
      { wavelengthNm: 2500, reflectance: 0.34 }
    ],
    fieldNotes: 'Crosta basáltica exposta a fumarolas ácidas secas — estudo aberto para calibração de emissividade térmica das missões VERITAS e DAVINCI.',
    version: 'v1.0.2-pds',
    status: 'under_review',
    officialSource: 'Dados de demonstração (fictícios)',
    peerComments: []
  }
];

/**
 * Demo samples with scores and fingerprints computed by the same code the app uses for
 * user data, instead of hand-typed numbers.
 */
export const INITIAL_SAMPLES: GeologicalSample[] = RAW_INITIAL_SAMPLES.map((sample) => {
  const site = ANALOGUE_SITES.find((s) => s.id === sample.siteId) || null;
  const withScores: GeologicalSample = {
    hash: '',
    ...sample,
    fidelityScores: computeAnalogueFidelity(sample, sample.targetPlanet, site),
  };
  return { ...withScores, hash: computeSampleFingerprint(withScores) };
});

export const INITIAL_COLLABORATOR_THREADS: Record<string, DirectResearchMessage[]> = {
  'col-cavalazzi': [
    {
      id: 'msg-cav-1',
      collaboratorId: 'col-cavalazzi',
      sender: 'researcher',
      senderName: 'Demo · Astrobiologia de Dallol',
      timestamp: 'Hoje · 09:40 UTC',
      content:
        'Disponibilizamos os novos espectros XRD dos terraços de Dallol (DNK-DAL-01 e DNK-VEN-02). Se sua equipe estiver cruzando dados de jarosita ou basalto alterado em Marte/Vênus, envie seus parâmetros aqui para compararmos.',
    },
  ],
  'col-reimold': [
    {
      id: 'msg-rei-1',
      collaboratorId: 'col-reimold',
      sender: 'researcher',
      senderName: 'Demo · Geologia de Impacto',
      timestamp: 'Ontem · 16:15 UTC',
      content:
        'Estamos validando lâminas de pseudotaquilito de Vredefort contra brechas Apollo 14. Conecte-se se precisar de correlação de metamorfismo de choque.',
    },
  ],
  'col-juma': [
    {
      id: 'msg-jum-1',
      collaboratorId: 'col-juma',
      sender: 'researcher',
      senderName: 'Demo · Geoquímica do Rift',
      timestamp: 'Ontem · 11:20 UTC',
      content:
        'As séries sazonais do Lago Natron em pH 10.5 estão abertas para modelagem das plumas de Encélado. Fico à disposição para discutir protocolos de coleta.',
    },
  ],
  'col-vargas': [
    {
      id: 'msg-var-1',
      collaboratorId: 'col-vargas',
      sender: 'researcher',
      senderName: 'Demo · Hiperaridez e Espectroscopia',
      timestamp: '2 dias atrás',
      content:
        'Compartilhei o conjunto ATACAMA-PAL-04 com dados de perclorato de magnésio e atividade de água aw 0.27 para comparação com desertos africanos.',
    },
  ],
  'col-mensah': [
    {
      id: 'msg-men-1',
      collaboratorId: 'col-mensah',
      sender: 'researcher',
      senderName: 'Demo · Geomorfologia Eólica',
      timestamp: 'Hoje · 08:10 UTC',
      content:
        'Os perfis granulométricos das dunas lineares do Namibe estão prontos para calibração de retroespalhamento de Titã (Dragonfly) e Marte.',
    },
  ],
};

export const INITIAL_NETWORK_GROUPS: import('../types').ResearchNetworkGroup[] = [
  {
    id: 'net-mars-evaporites',
    title: 'Consórcio Afar–Atacama: Evaporitos de Marte',
    targetPlanet: 'Mars',
    objective: 'Cruzamento espectral SWIR e limites de atividade de água (aw) entre Dallol e Salar de Pajonales para calibração do rover Perseverance.',
    memberIds: ['col-cavalazzi', 'col-vargas'],
    createdAt: '2026-04-12',
  },
  {
    id: 'net-moon-impact',
    title: 'Rede Vredefort–Artemis: Brechas & Regolito Lunar',
    targetPlanet: 'Moon',
    objective: 'Mapeamento de metamorfismo de choque, ilmenita e fusões de impacto análogas à Cratera Shackleton.',
    memberIds: ['col-reimold'],
    createdAt: '2026-04-19',
  },
  {
    id: 'net-ocean-worlds',
    title: 'Grupo Mundos Oceânicos: Rift Leste-Africano & Encélado',
    targetPlanet: 'Enceladus',
    objective: 'Avaliação geoquímica de lagos carbonatados alcalinos (Lago Natron) para modelagem das plumas criovulcânicas.',
    memberIds: ['col-juma', 'col-cavalazzi'],
    createdAt: '2026-04-28',
  },
  {
    id: 'net-titan-aeolian',
    title: 'Rede Eólica Namibe–Titã (Dragonfly)',
    targetPlanet: 'Titan',
    objective: 'Dinâmica de dunas lineares gigantes e transporte de sedimentos orgânicos/férricos.',
    memberIds: ['col-mensah'],
    createdAt: '2026-05-02',
  },
];
