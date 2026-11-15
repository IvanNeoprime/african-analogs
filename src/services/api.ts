import type {
  CollaboratorProfile,
  DirectResearchMessage,
  GeologicalSample,
  ResearchNetworkGroup,
} from '../types';
import { getSessionToken } from './localAccountStore';

/**
 * Client for the shared research database. Reads are public; writes need a session and
 * change exactly one record, so people working at the same time don't overwrite each other.
 */

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const token = getSessionToken();
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Sem ligação ao servidor. A alteração ficou guardada só neste navegador.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as any)?.error || `Erro ${res.status} no servidor.`, res.status);
  return data as T;
}

export interface SharedData {
  customProfiles: CollaboratorProfile[];
  samples: GeologicalSample[];
  studyThreads: Record<string, DirectResearchMessage[]>;
  networkGroups: ResearchNetworkGroup[];
}

export const api = {
  hasSession: () => Boolean(getSessionToken()),

  loadSharedData: () => request<SharedData>('GET', '/api/data'),

  saveProfile: (profile: CollaboratorProfile) =>
    request<{ profile: CollaboratorProfile }>('PUT', '/api/profiles/me', profile).then((r) => r.profile),

  saveSample: (sample: GeologicalSample) =>
    request<{ sample: GeologicalSample }>('PUT', `/api/samples/${encodeURIComponent(sample.id)}`, sample).then((r) => r.sample),

  deleteSample: (id: string) => request<{ ok: true }>('DELETE', `/api/samples/${encodeURIComponent(id)}`),

  addComment: (sampleId: string, comment: { content: string; endorse: boolean; author: string; role: string; institution: string }) =>
    request<{ sample: GeologicalSample }>('POST', `/api/samples/${encodeURIComponent(sampleId)}/comments`, comment).then(
      (r) => r.sample
    ),

  addStudyMessage: (sampleId: string, message: DirectResearchMessage) =>
    request<{ message: DirectResearchMessage }>('POST', `/api/samples/${encodeURIComponent(sampleId)}/messages`, message).then(
      (r) => r.message
    ),

  createGroup: (group: ResearchNetworkGroup) =>
    request<{ group: ResearchNetworkGroup }>('POST', '/api/groups', group).then((r) => r.group),

  toggleGroupMembership: (groupId: string) =>
    request<{ joined: boolean; group: ResearchNetworkGroup }>('POST', `/api/groups/${encodeURIComponent(groupId)}/membership`),
};

/** Merge server records over local ones by id (server wins), keeping local-only items. */
export function mergeById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const remoteIds = new Set(remote.map((r) => r.id));
  return [...remote, ...local.filter((l) => !remoteIds.has(l.id))];
}
