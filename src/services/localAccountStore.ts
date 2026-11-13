import {
  CollaboratorProfile,
  DirectResearchMessage,
  GeologicalSample,
  LocalUserAccount,
  PlanetaryTarget,
  ResearchNetworkGroup,
} from '../types';
import { HARDCODED_API_ENDPOINTS } from './officialApis';

const STORAGE_KEYS = {
  ACCOUNTS: 'african_analogs_accounts_v1',
  PROFILES: 'african_analogs_dynamic_profiles_v1',
  SESSION_USER_ID: 'african_analogs_session_uid_v1',
  SAMPLES: 'african_analogs_samples_v1',
  CONNECTED_IDS: 'african_analogs_connected_v1',
  DIRECT_THREADS: 'african_analogs_direct_threads_v1',
  STUDY_THREADS: 'african_analogs_study_threads_v1',
  NETWORK_GROUPS: 'african_analogs_network_groups_v1',
} as const;

export interface LocalWorkspaceState {
  accounts: LocalUserAccount[];
  customProfiles: CollaboratorProfile[];
  sessionUserId: string | null;
  samples: GeologicalSample[] | null;
  connectedIds: string[] | null;
  directThreads: Record<string, DirectResearchMessage[]> | null;
  studyThreads: Record<string, DirectResearchMessage[]> | null;
  networkGroups: ResearchNetworkGroup[] | null;
}

export async function hashPasswordSha256(password: string): Promise<string> {
  const encoded = new TextEncoder().encode(`african-analogs::${password}`);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateDynamicAvatarSvg(name: string, accentHex = '#1E3A8A'): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'AA';

  const palette = ['#1E3A8A', '#0F766E', '#B45309', '#1D4ED8', '#047857'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  const bg = accentHex || palette[hash % palette.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="80" fill="${bg}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#FFFFFF" font-family="Roboto, Arial, sans-serif" font-size="56" font-weight="700">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function safeReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

export function loadLocalWorkspaceState(): LocalWorkspaceState {
  return {
    accounts: safeReadJson<LocalUserAccount[]>(STORAGE_KEYS.ACCOUNTS, []),
    customProfiles: safeReadJson<CollaboratorProfile[]>(STORAGE_KEYS.PROFILES, []),
    sessionUserId: safeReadJson<string | null>(STORAGE_KEYS.SESSION_USER_ID, null),
    samples: safeReadJson<GeologicalSample[] | null>(STORAGE_KEYS.SAMPLES, null),
    connectedIds: safeReadJson<string[] | null>(STORAGE_KEYS.CONNECTED_IDS, null),
    directThreads: safeReadJson<Record<string, DirectResearchMessage[]> | null>(
      STORAGE_KEYS.DIRECT_THREADS,
      null
    ),
    studyThreads: safeReadJson<Record<string, DirectResearchMessage[]> | null>(
      STORAGE_KEYS.STUDY_THREADS,
      null
    ),
    networkGroups: safeReadJson<ResearchNetworkGroup[] | null>(STORAGE_KEYS.NETWORK_GROUPS, null),
  };
}

export function persistAccountsAndProfiles(
  accounts: LocalUserAccount[],
  customProfiles: CollaboratorProfile[],
  sessionUserId: string | null
): void {
  safeWriteJson(STORAGE_KEYS.ACCOUNTS, accounts);
  safeWriteJson(STORAGE_KEYS.PROFILES, customProfiles);
  safeWriteJson(STORAGE_KEYS.SESSION_USER_ID, sessionUserId);
  void syncStateToLocalServer({ accounts, customProfiles });
}

export function persistWorkspaceCollections(payload: {
  samples: GeologicalSample[];
  connectedIds: string[];
  directThreads: Record<string, DirectResearchMessage[]>;
  studyThreads: Record<string, DirectResearchMessage[]>;
  networkGroups: ResearchNetworkGroup[];
}): void {
  safeWriteJson(STORAGE_KEYS.SAMPLES, payload.samples);
  safeWriteJson(STORAGE_KEYS.CONNECTED_IDS, payload.connectedIds);
  safeWriteJson(STORAGE_KEYS.DIRECT_THREADS, payload.directThreads);
  safeWriteJson(STORAGE_KEYS.STUDY_THREADS, payload.studyThreads);
  safeWriteJson(STORAGE_KEYS.NETWORK_GROUPS, payload.networkGroups);
  void syncStateToLocalServer(payload);
}

export async function syncStateToLocalServer(partialState: Record<string, unknown>): Promise<void> {
  try {
    await fetch(HARDCODED_API_ENDPOINTS.BACKEND_LOCAL_STATE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partialState),
    });
  } catch {
    // LocalStorage remains primary guaranteed persistence even offline
  }
}

export async function fetchServerLocalState(): Promise<Partial<LocalWorkspaceState> | null> {
  try {
    const res = await fetch(HARDCODED_API_ENDPOINTS.BACKEND_LOCAL_STATE);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function normalizeCodename(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `@${cleaned || 'pesquisador'}`;
}

export interface RegisterAccountInput {
  name: string;
  codename: string;
  email: string;
  password: string;
  institution: string;
  country: string;
  role: string;
  specialty: string;
  bio: string;
  focusPlanets: PlanetaryTarget[];
  openToContributions: boolean;
  orcid?: string;
  avatarUrl?: string;
}

export async function createLocalAccountRecord(
  input: RegisterAccountInput,
  existingAccounts: LocalUserAccount[],
  existingProfiles: CollaboratorProfile[]
): Promise<{ account: LocalUserAccount; profile: CollaboratorProfile }> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedCodename = normalizeCodename(input.codename);

  if (!input.name.trim() || !normalizedEmail || !input.password) {
    throw new Error('Preencha nome completo, e-mail e senha para concluir o cadastro.');
  }
  if (input.password.length < 6) {
    throw new Error('A senha deve possuir no mínimo 6 caracteres.');
  }
  if (existingAccounts.some((acc) => acc.email.toLowerCase() === normalizedEmail)) {
    throw new Error('Já existe uma conta cadastrada localmente com este e-mail.');
  }
  if (
    existingAccounts.some((acc) => acc.codename.toLowerCase() === normalizedCodename.toLowerCase()) ||
    existingProfiles.some((p) => p.codename.toLowerCase() === normalizedCodename.toLowerCase())
  ) {
    throw new Error(`O codinome ${normalizedCodename} já está em uso. Escolha outro identificador.`);
  }

  const nowIso = new Date().toISOString();
  const id = `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const passwordHash = await hashPasswordSha256(input.password);

  const profile: CollaboratorProfile = {
    id,
    name: input.name.trim(),
    codename: normalizedCodename,
    avatarUrl: input.avatarUrl?.trim() || generateDynamicAvatarSvg(input.name),
    role: input.role.trim() || 'Pesquisador de Análogos Planetários',
    institution: input.institution.trim() || 'Pesquisador Independente',
    country: input.country.trim() || 'Angola / África',
    specialty: input.specialty.trim() || 'Geomorfologia Comparada e Espectroscopia de Campo',
    bio:
      input.bio.trim() ||
      'Pesquisador registrado na rede African Analogs para coleta de dados oficiais e validação colaborativa.',
    focusPlanets: input.focusPlanets.length > 0 ? input.focusPlanets : ['Mars'],
    openToContributions: input.openToContributions,
    email: normalizedEmail,
    orcid: input.orcid?.trim() || undefined,
    joinedAt: nowIso.split('T')[0],
    isLocalRegistered: true,
  };

  const account: LocalUserAccount = {
    id,
    email: normalizedEmail,
    codename: normalizedCodename,
    passwordHash,
    createdAt: nowIso,
    updatedAt: nowIso,
    profileId: id,
  };

  return { account, profile };
}

export async function authenticateLocalAccount(
  identifier: string,
  password: string,
  accounts: LocalUserAccount[]
): Promise<LocalUserAccount> {
  const cleanId = identifier.trim().toLowerCase();
  const normalizedCode = cleanId.startsWith('@') ? cleanId : `@${cleanId}`;
  const found = accounts.find(
    (acc) => acc.email.toLowerCase() === cleanId || acc.codename.toLowerCase() === normalizedCode
  );
  if (!found) {
    throw new Error('Conta não encontrada no armazenamento local. Verifique o e-mail/codinome ou crie uma nova conta.');
  }
  const candidateHash = await hashPasswordSha256(password);
  if (candidateHash !== found.passwordHash) {
    throw new Error('Senha incorreta para esta conta.');
  }
  return found;
}
