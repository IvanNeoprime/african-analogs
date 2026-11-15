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
  SESSION_TOKEN: 'african_analogs_session_token_v2',
} as const;

const AUTH_ENDPOINTS = {
  REGISTER: '/api/auth/register',
  LOGIN: '/api/auth/login',
  PASSWORD: '/api/auth/password',
  LOGOUT: '/api/auth/logout',
} as const;

export const MIN_PASSWORD_LENGTH = 8;

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
  } catch {
    return null;
  }
}

function setSessionToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, token);
    else localStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
  } catch {
    // storage unavailable: the session simply won't survive a reload
  }
}

/** Removes password material before anything is written to the browser or sent to the server. */
export function sanitizeAccounts(accounts: LocalUserAccount[]): LocalUserAccount[] {
  return accounts.map(({ passwordHash: _omit, ...rest }) => rest);
}

async function postJson<T>(url: string, body: unknown, token?: string | null): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Sem ligação ao servidor. Verifique a sua ligação e tente novamente.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as any)?.error || `Erro ${res.status} no servidor.`);
    (err as any).status = res.status;
    throw err;
  }
  return data as T;
}

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

/** Only used to migrate accounts created by older builds, which stored this hash in the browser. */
async function legacyPasswordSha256(password: string): Promise<string> {
  const encoded = new TextEncoder().encode(`african-analogs::${password}`);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Initials avatar; the colour comes from the name unless one is given, so people are distinguishable. */
export function generateDynamicAvatarSvg(name: string, accentHex?: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'AA';

  // Dark enough for white initials (contrast ≥ 4.5:1) and distinct from each other.
  const palette = ['#1E3A8A', '#0F766E', '#9A3412', '#6D28D9', '#047857', '#9D174D', '#155E75', '#854D0E'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  const bg = accentHex ?? palette[hash % palette.length];
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
  // Legacy hashes are kept locally only until the account is migrated on its next login.
  safeWriteJson(STORAGE_KEYS.ACCOUNTS, accounts);
  safeWriteJson(STORAGE_KEYS.PROFILES, customProfiles);
  safeWriteJson(STORAGE_KEYS.SESSION_USER_ID, sessionUserId);
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

export interface AuthResult {
  account: LocalUserAccount;
  token: string;
}

function buildProfile(id: string, input: RegisterAccountInput, email: string, codename: string): CollaboratorProfile {
  return {
    id,
    name: input.name.trim(),
    codename,
    avatarUrl: input.avatarUrl?.trim() || generateDynamicAvatarSvg(input.name),
    role: input.role.trim() || 'Pesquisador de Análogos Planetários',
    institution: input.institution.trim() || 'Pesquisador Independente',
    country: input.country.trim() || 'Não indicado',
    specialty: input.specialty.trim() || 'Não indicada',
    bio: input.bio.trim() || 'Pesquisador registado na rede African Analogs.',
    focusPlanets: input.focusPlanets.length > 0 ? input.focusPlanets : ['Mars'],
    openToContributions: input.openToContributions,
    email,
    orcid: input.orcid?.trim() || undefined,
    joinedAt: new Date().toISOString().split('T')[0],
    isLocalRegistered: true,
  };
}

/**
 * Creates the account on the server (the password is hashed there with scrypt and
 * never stored in the browser) and returns the public account record + its profile.
 */
export async function registerAccount(
  input: RegisterAccountInput,
  existingProfiles: CollaboratorProfile[]
): Promise<AuthResult & { profile: CollaboratorProfile }> {
  const email = input.email.trim().toLowerCase();
  const codename = normalizeCodename(input.codename || input.name);

  if (!input.name.trim() || !email || !input.password) {
    throw new Error('Preencha nome completo, e-mail e senha para concluir o cadastro.');
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  if (existingProfiles.some((p) => p.codename.toLowerCase() === codename.toLowerCase())) {
    throw new Error(`O codinome ${codename} já está em uso. Escolha outro identificador.`);
  }

  const { account, token } = await postJson<AuthResult>(AUTH_ENDPOINTS.REGISTER, {
    email,
    codename,
    password: input.password,
  });
  setSessionToken(token);
  return { account, token, profile: buildProfile(account.id, input, email, account.codename) };
}

/**
 * Signs in against the server. Accounts created by older builds (password hash kept in
 * the browser) are migrated to the server transparently on their first successful login.
 */
export async function loginAccount(
  identifier: string,
  password: string,
  localAccounts: LocalUserAccount[]
): Promise<AuthResult> {
  try {
    const result = await postJson<AuthResult>(AUTH_ENDPOINTS.LOGIN, { identifier, password });
    setSessionToken(result.token);
    return result;
  } catch (err: any) {
    if (err?.status !== 401) throw err;

    const cleanId = identifier.trim().toLowerCase();
    const asCodename = cleanId.startsWith('@') ? cleanId : `@${cleanId}`;
    const legacy = localAccounts.find(
      (a) => a.passwordHash && (a.email.toLowerCase() === cleanId || a.codename.toLowerCase() === asCodename)
    );
    if (!legacy || (await legacyPasswordSha256(password)) !== legacy.passwordHash) throw err;

    const migrated = await postJson<AuthResult>(AUTH_ENDPOINTS.REGISTER, {
      id: legacy.id,
      email: legacy.email,
      codename: legacy.codename,
      password,
    }).catch((regErr: any) => {
      if (regErr?.status === 400 && password.length < MIN_PASSWORD_LENGTH) {
        throw new Error(
          `Esta conta antiga usa uma senha com menos de ${MIN_PASSWORD_LENGTH} caracteres. Crie uma conta nova com uma senha mais forte.`
        );
      }
      throw regErr;
    });
    setSessionToken(migrated.token);
    return migrated;
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`A nova senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  await postJson(AUTH_ENDPOINTS.PASSWORD, { currentPassword, newPassword }, getSessionToken());
}

export async function logoutAccount(): Promise<void> {
  const token = getSessionToken();
  setSessionToken(null);
  if (token) {
    await postJson(AUTH_ENDPOINTS.LOGOUT, {}, token).catch(() => undefined);
  }
}
