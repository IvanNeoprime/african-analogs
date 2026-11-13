export type PlanetaryTarget =
  | 'Mercury'
  | 'Venus'
  | 'Earth'
  | 'Mars'
  | 'Jupiter'
  | 'Saturn'
  | 'Uranus'
  | 'Neptune'
  | 'Ceres'
  | 'Pluto'
  | 'Moon'
  | 'Phobos'
  | 'Deimos'
  | 'Io'
  | 'Europa'
  | 'Ganymede'
  | 'Callisto'
  | 'Mimas'
  | 'Enceladus'
  | 'Tethys'
  | 'Dione'
  | 'Rhea'
  | 'Titan'
  | 'Iapetus'
  | 'Miranda'
  | 'Ariel'
  | 'Umbriel'
  | 'Titania'
  | 'Oberon'
  | 'Triton'
  | 'Charon'
  | 'Both';

export interface SpectralPoint {
  wavelengthNm: number;
  reflectance: number;
}

export interface CollaboratorProfile {
  id: string;
  name: string;
  codename: string;
  avatarUrl: string;
  role: string;
  institution: string;
  country: string;
  specialty: string;
  bio: string;
  focusPlanets: PlanetaryTarget[];
  openToContributions: boolean;
  email?: string;
  orcid?: string;
  joinedAt?: string;
  isLocalRegistered?: boolean;
}

export interface LocalUserAccount {
  id: string;
  email: string;
  codename: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  profileId: string;
}

export interface OfficialApiEndpoint {
  id: string;
  name: string;
  provider: string;
  category: 'Geoespacial / DEM' | 'Satélite / NASA' | 'IA & Visão' | 'Contas & Armazenamento';
  endpoint: string;
  authMode: 'Pública (Hardcoded)' | 'Proxy Servidor Integrado';
  description: string;
}

export interface DirectResearchMessage {
  id: string;
  collaboratorId: string;
  sender: 'user' | 'researcher';
  senderName: string;
  timestamp: string;
  content: string;
}

export interface AnalogueSite {
  id: string;
  name: string;
  targetPlanet: PlanetaryTarget;
  location: string;
  country: string;
  region: 'África' | 'América do Sul' | 'Europa' | 'Ártico' | 'Atlântico';
  coordinates: [number, number]; // [lat, lng]
  elevationMeters: number;
  geologyType: string;
  planetaryCounterpart: string;
  fidelityScore: number; // 0 - 100
  description: string;
  primaryMinerals: string[];
  atmosphericPressureMbar: number;
  uvRadiationWm2: number;
  waterActivityAw: number;
  analogousFeatures: string[];
  nasaInstrumentsTested: string[];
  scientificPapersCount: number;
  dataSource: string; // e.g., "NASA PDS / OpenTopography SRTM"
  radarAxes: {
    mineralogy: number;
    geomorphology: number;
    geochemistry: number;
    radiation: number;
    thermal: number;
  };
  sampleSpectralCurve: SpectralPoint[];
}

export interface ResearchTimelineStep {
  id: string;
  stage: string;
  timestamp: string;
  author: string;
  detail: string;
  status: 'completed' | 'in_progress';
}

export interface ResearchNetworkGroup {
  id: string;
  title: string;
  targetPlanet: PlanetaryTarget;
  objective: string;
  memberIds: string[];
  createdAt: string;
}

export interface GeologicalSample {
  id: string;
  name: string;
  siteId: string;
  customLocation?: string;
  collaboratorId?: string;
  collectorName: string;
  institution: string;
  collectedAt: string;
  coordinates: [number, number];
  depthCm: number;
  rockClassification: string;
  targetPlanet: PlanetaryTarget;
  waterActivity: number; // aw 0.0 - 1.0
  pH: number;
  porosityPercent: number;
  minerals: { [mineralName: string]: number }; // wt%
  xrfComposition: { [oxide: string]: number };
  fidelityScores: {
    mineralogy: number;
    geomorphology: number;
    geochemistry: number;
    radiation: number;
    thermal: number;
    total: number;
  };
  spectralCurve: SpectralPoint[];
  fieldNotes: string;
  conclusion?: string;
  reportSummary?: string;
  timeline?: ResearchTimelineStep[];
  version: string;
  hash: string;
  status: 'draft' | 'under_review' | 'verified_peer_reviewed';
  officialSource: string;
  peerComments?: PeerComment[];
}

export interface LatestAiAnalysisSnapshot {
  title?: string;
  customLocation?: string;
  targetPlanet: PlanetaryTarget;
  chatReply?: string;
  diagnosticResult?: string;
  reportText?: string;
  visionClosestAnalogue?: string;
  visionMinerals?: string[];
  visionScore?: number;
  waterActivity?: number;
  pH?: number;
  depthCm?: number;
  porosityPercent?: number;
  minerals?: { [mineralName: string]: number };
  xrfComposition?: { [oxide: string]: number };
  fidelityScores?: GeologicalSample['fidelityScores'];
  updatedAt: string;
}

export interface PeerComment {
  id: string;
  sampleId: string;
  author: string;
  role: string;
  institution: string;
  timestamp: string;
  content: string;
  statusChange?: 'approved' | 'revision_requested';
}
