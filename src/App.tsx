import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Navigation, CleanMenuTab } from './components/Navigation';
import { UnifiedResearchWorkspace } from './components/UnifiedResearchWorkspace';
// Secondary tabs are loaded on demand to keep the first page load small.
const ResearcherCollaborationFeed = lazy(() =>
  import('./components/ResearcherCollaborationFeed').then((m) => ({ default: m.ResearcherCollaborationFeed }))
);
const AccountEcosystemView = lazy(() =>
  import('./components/AccountEcosystemView').then((m) => ({ default: m.AccountEcosystemView }))
);

const TabFallback = () => (
  <div role="status" className="py-16 text-center text-sm text-[#475569] dark:text-[#94A3B8]">
    A carregar…
  </div>
);

import {
  ANALOGUE_SITES,
  COLLABORATORS,
  INITIAL_COLLABORATOR_THREADS,
  INITIAL_NETWORK_GROUPS,
  INITIAL_SAMPLES,
  LEGACY_NAME_REPLACEMENTS,
} from './data/planetaryData';
import {
  AnalogueSite,
  CollaboratorProfile,
  DirectResearchMessage,
  GeologicalSample,
  LatestAiAnalysisSnapshot,
  LocalUserAccount,
  PeerComment,
  PlanetaryTarget,
  ResearchNetworkGroup,
} from './types';
import { computeAnalogueFidelity, generateSpectralReflectanceCurve } from './services/spectralEngine';
import { computeSampleFingerprint } from './services/fingerprint';
import { endorseBlockReason, reviewStatus } from './services/peerReview';
import { api, ApiError, mergeById } from './services/api';

/** Merges two message maps (per study), de-duplicating by message id and keeping time order. */
function mergeThreads(
  local: Record<string, DirectResearchMessage[]>,
  remote: Record<string, DirectResearchMessage[]>
): Record<string, DirectResearchMessage[]> {
  const out: Record<string, DirectResearchMessage[]> = { ...local };
  for (const [sampleId, msgs] of Object.entries(remote)) {
    const byId = new Map((out[sampleId] || []).map((m) => [m.id, m]));
    for (const m of msgs) byId.set(m.id, m);
    out[sampleId] = [...byId.values()].sort((a, b) => (a.sentAt || '').localeCompare(b.sentAt || ''));
  }
  return out;
}
import {
  changePassword,
  getSessionToken,
  loadLocalWorkspaceState,
  loginAccount,
  logoutAccount,
  persistAccountsAndProfiles,
  persistWorkspaceCollections,
  registerAccount,
  RegisterAccountInput,
} from './services/localAccountStore';

/**
 * Data saved by older builds may still carry real researchers' names that were used in the
 * demo content. Relabel them with the fictional demo names before anything is shown.
 */
function relabelLegacyDemoNames<T>(value: T): T {
  if (value === null || value === undefined) return value;
  let json = JSON.stringify(value);
  for (const [from, to] of Object.entries(LEGACY_NAME_REPLACEMENTS)) {
    json = json.split(JSON.stringify(from).slice(1, -1)).join(JSON.stringify(to).slice(1, -1));
  }
  return JSON.parse(json) as T;
}

// ---------------------------------------------------------------------------
// Shareable page addresses (hash routes), so links can be sent and Back works:
//   #/pesquisa · #/comunidade · #/comunidade/pessoa/<id> · #/comunidade/estudo/<id> · #/conta
// ---------------------------------------------------------------------------
interface Route {
  tab: CleanMenuTab;
  personId?: string;
  studyId?: string;
}

function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case 'comunidade':
      if (parts[1] === 'pessoa' && parts[2]) return { tab: 'peer_network', personId: parts[2] };
      if (parts[1] === 'estudo' && parts[2]) return { tab: 'peer_network', studyId: parts[2] };
      return { tab: 'peer_network' };
    case 'conta':
      return { tab: 'account_profile' };
    default:
      return { tab: 'research_workspace' };
  }
}

function routeToHash(route: Route): string {
  if (route.tab === 'account_profile') return '#/conta';
  if (route.tab === 'peer_network') {
    if (route.studyId) return `#/comunidade/estudo/${encodeURIComponent(route.studyId)}`;
    if (route.personId) return `#/comunidade/pessoa/${encodeURIComponent(route.personId)}`;
    return '#/comunidade';
  }
  return '#/pesquisa';
}

export default function App() {
  const initialRoute = useMemo(() => parseRoute(window.location.hash), []);
  const initialLocal = useMemo(() => {
    const state = loadLocalWorkspaceState();
    return {
      ...state,
      // Re-derive review status: older builds marked a study "validated" after a single endorsement.
      samples: relabelLegacyDemoNames(state.samples)?.map((s) => ({ ...s, status: reviewStatus(s) })) ?? null,
      directThreads: relabelLegacyDemoNames(state.directThreads),
      studyThreads: relabelLegacyDemoNames(state.studyThreads),
    };
  }, []);

  const [activeTab, setActiveTab] = useState<CleanMenuTab>(initialRoute.tab);
  const [focusedStudyId, setFocusedStudyId] = useState<string | null>(initialRoute.studyId || null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return localStorage.getItem('african-analogs-theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('african-analogs-theme', theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // --- Accounts, Dynamic Profiles & Local Persistence States ---
  const [accounts, setAccounts] = useState<LocalUserAccount[]>(initialLocal.accounts);
  const [customProfiles, setCustomProfiles] = useState<CollaboratorProfile[]>(initialLocal.customProfiles);
  const [sessionUserId, setSessionUserId] = useState<string | null>(initialLocal.sessionUserId);
  const [focusedCollaboratorId, setFocusedCollaboratorId] = useState<string | null>(initialRoute.personId || null);

  // Keep the address bar in sync with what is on screen (each change is a history entry).
  const currentHash = routeToHash({
    tab: activeTab,
    personId: focusedCollaboratorId || undefined,
    studyId: focusedStudyId || undefined,
  });
  useEffect(() => {
    if (window.location.hash === currentHash) return;
    if (!window.location.hash) {
      window.history.replaceState(null, '', currentHash);
    } else {
      window.location.hash = currentHash;
    }
  }, [currentHash]);

  // Back/Forward and links pasted into the address bar.
  useEffect(() => {
    const onHashChange = () => {
      const route = parseRoute(window.location.hash);
      setActiveTab(route.tab);
      setFocusedCollaboratorId(route.personId || null);
      setFocusedStudyId(route.studyId || null);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const [sites] = useState<AnalogueSite[]>(ANALOGUE_SITES);
  const [baseCollaborators] = useState<CollaboratorProfile[]>(COLLABORATORS);
  const [connectedIds, setConnectedIds] = useState<string[]>(
    initialLocal.connectedIds || ['col-cavalazzi']
  );
  const [directThreads, setDirectThreads] = useState<Record<string, DirectResearchMessage[]>>(
    initialLocal.directThreads || INITIAL_COLLABORATOR_THREADS
  );
  const [studyThreads, setStudyThreads] = useState<Record<string, DirectResearchMessage[]>>(
    initialLocal.studyThreads || {}
  );
  const [networkGroups, setNetworkGroups] = useState<ResearchNetworkGroup[]>(
    initialLocal.networkGroups || INITIAL_NETWORK_GROUPS
  );

  const [selectedSite, setSelectedSite] = useState<AnalogueSite>(ANALOGUE_SITES[0]);
  const [samples, setSamples] = useState<GeologicalSample[]>(
    initialLocal.samples && initialLocal.samples.length > 0 ? initialLocal.samples : INITIAL_SAMPLES
  );
  const [activeSample, setActiveSample] = useState<GeologicalSample>(
    (initialLocal.samples && initialLocal.samples[0]) || INITIAL_SAMPLES[0]
  );

  const [visionData, setVisionData] = useState<any | null>(null);
  const [attachedDiagnostics, setAttachedDiagnostics] = useState<string | null>(null);
  const [latestAiAnalysis, setLatestAiAnalysis] = useState<LatestAiAnalysisSnapshot | null>(null);
  const [publishTriggerCount, setPublishTriggerCount] = useState(0);

  // --- Shared database (SQLite on the server) ---
  // Every visitor loads the shared studies, profiles, discussions and groups. Records from the
  // server win over local copies; demo content and anonymous drafts stay local.
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!syncNotice) return;
    const t = setTimeout(() => setSyncNotice(null), 6000);
    return () => clearTimeout(t);
  }, [syncNotice]);

  /** Runs a server write when signed in; failures are shown, local changes are kept. */
  const syncRemote = (label: string, write: () => Promise<unknown>) => {
    if (!api.hasSession()) return;
    write().catch((err: unknown) => {
      if (err instanceof ApiError && err.status === 404) return; // demo / local-only record
      setSyncNotice(`${label}: ${(err as Error).message}`);
    });
  };

  const [sharedDataVersion, setSharedDataVersion] = useState(0);
  useEffect(() => {
    let mounted = true;
    api
      .loadSharedData()
      .then((remote) => {
        if (!mounted) return;
        setCustomProfiles((prev) => mergeById(prev, remote.customProfiles));
        setSamples((prev) => mergeById(prev, relabelLegacyDemoNames(remote.samples)));
        setStudyThreads((prev) => mergeThreads(prev, remote.studyThreads));
        setNetworkGroups((prev) => mergeById(prev, remote.networkGroups));
      })
      .catch(() => setSyncNotice('Servidor indisponível: a mostrar só os dados guardados neste navegador.'));
    return () => {
      mounted = false;
    };
  }, [sharedDataVersion]);

  // Combined Collaborators (Dynamic registered profiles appear right alongside core researchers)
  const allCollaborators = useMemo(() => {
    const mergedMap = new Map<string, CollaboratorProfile>();
    for (const p of customProfiles) {
      mergedMap.set(p.id, p);
    }
    for (const base of baseCollaborators) {
      if (!mergedMap.has(base.id)) {
        mergedMap.set(base.id, base);
      }
    }
    return Array.from(mergedMap.values());
  }, [customProfiles, baseCollaborators]);

  const currentUser = useMemo(() => {
    if (!sessionUserId) return null;
    return allCollaborators.find((c) => c.id === sessionUserId) || null;
  }, [sessionUserId, allCollaborators]);

  // Sync collections cleanly to localStorage + local Express store
  useEffect(() => {
    persistAccountsAndProfiles(accounts, customProfiles, sessionUserId);
  }, [accounts, customProfiles, sessionUserId]);

  useEffect(() => {
    persistWorkspaceCollections({
      samples,
      connectedIds,
      directThreads,
      studyThreads,
      networkGroups,
    });
  }, [samples, connectedIds, directThreads, studyThreads, networkGroups]);

  // --- Account & Dynamic Profile Actions ---
  const handleRegisterAccount = async (input: RegisterAccountInput) => {
    const { account, profile } = await registerAccount(input, allCollaborators);
    setAccounts((prev) => [account, ...prev.filter((a) => a.id !== account.id)]);
    setCustomProfiles((prev) => [profile, ...prev.filter((p) => p.id !== profile.id)]);
    setSessionUserId(profile.id);
    syncRemote('Perfil não publicado', () => api.saveProfile(profile));
  };

  const handleLoginAccount = async (identifier: string, password: string) => {
    const { account } = await loginAccount(identifier, password, accounts);
    // Replace any legacy local copy (which may still hold an old password hash) with the server record.
    setAccounts((prev) => [account, ...prev.filter((a) => a.id !== account.id)]);
    setSessionUserId(account.profileId);
    setSharedDataVersion((v) => v + 1);
  };

  const handleUpdateDynamicProfile = (profileId: string, patch: Partial<CollaboratorProfile>) => {
    setCustomProfiles((prev) => {
      const exists = prev.some((p) => p.id === profileId);
      if (!exists) {
        const target = allCollaborators.find((c) => c.id === profileId);
        return target ? [{ ...target, ...patch }, ...prev] : prev;
      }
      return prev.map((p) => (p.id === profileId ? { ...p, ...patch } : p));
    });

    if (patch.codename) {
      setAccounts((prev) =>
        prev.map((acc) =>
          acc.profileId === profileId
            ? { ...acc, codename: patch.codename!, updatedAt: new Date().toISOString() }
            : acc
        )
      );
    }

    if (patch.name || patch.institution) {
      const renamed = samples
        .filter((s) => s.collaboratorId === profileId)
        .map((s) => ({ ...s, collectorName: patch.name || s.collectorName, institution: patch.institution || s.institution }));
      const byId = new Map(renamed.map((s) => [s.id, s]));
      setSamples((prev) => prev.map((s) => byId.get(s.id) || s));
      if (profileId === sessionUserId) {
        for (const s of renamed) syncRemote('Estudo não atualizado', () => api.saveSample(s));
      }
    }

    if (profileId === sessionUserId) {
      const current = allCollaborators.find((c) => c.id === profileId);
      if (current) syncRemote('Perfil não guardado no servidor', () => api.saveProfile({ ...current, ...patch }));
    }
  };

  const handleUpdatePassword = async (
    accountId: string,
    currentPassword: string,
    newPassword: string
  ) => {
    if (!accounts.some((a) => a.id === accountId)) throw new Error('Conta não encontrada.');
    await changePassword(currentPassword, newPassword);
    setAccounts((prev) =>
      prev.map((a) => (a.id === accountId ? { ...a, updatedAt: new Date().toISOString() } : a))
    );
  };

  const handleLogout = () => {
    void logoutAccount();
    setSessionUserId(null);
  };

  // A stored session id without a server token (e.g. from an older build) is not a real session.
  useEffect(() => {
    if (sessionUserId && !getSessionToken()) setSessionUserId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Saves a study locally and, when signed in, in the shared database (server copy wins). */
  const handleSaveSample = (sample: GeologicalSample) => {
    setSamples((prev) => [sample, ...prev.filter((s) => s.id !== sample.id)]);
    setActiveSample(sample);
    syncRemote('Estudo não publicado no servidor', () =>
      api.saveSample(sample).then((saved) => {
        setSamples((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
        setActiveSample((cur) => (cur.id === saved.id ? saved : cur));
      })
    );
  };

  const handlePublishStudyFromProfile = (newStudy: GeologicalSample) => handleSaveSample(newStudy);

  const handleDeleteOwnSample = (sampleId: string) => {
    setSamples((prev) => prev.filter((s) => s.id !== sampleId));
    syncRemote('Estudo não apagado no servidor', () => api.deleteSample(sampleId));
  };

  // --- Collaboration & Network Actions ---
  const handleToggleConnect = (collaboratorId: string) => {
    setConnectedIds((prev) =>
      prev.includes(collaboratorId)
        ? prev.filter((id) => id !== collaboratorId)
        : [...prev, collaboratorId]
    );
  };

  const handleSendDirectMessage = (collaboratorId: string, msg: DirectResearchMessage) => {
    setDirectThreads((prev) => ({
      ...prev,
      [collaboratorId]: [...(prev[collaboratorId] || []), msg],
    }));
  };

  const handleSendStudyMessage = (sampleId: string, msg: DirectResearchMessage) => {
    setStudyThreads((prev) => ({
      ...prev,
      [sampleId]: [...(prev[sampleId] || []), msg],
    }));
    // Only people's messages are shared; automatic AI replies stay with the person who asked.
    if (msg.sender === 'user') {
      syncRemote('Mensagem não enviada ao servidor', () => api.addStudyMessage(sampleId, msg));
    }
  };

  const handleCreateNetworkGroup = (group: ResearchNetworkGroup) => {
    setNetworkGroups((prev) => [group, ...prev]);
    syncRemote('Grupo não criado no servidor', () =>
      api.createGroup(group).then((saved) => setNetworkGroups((prev) => prev.map((g) => (g.id === saved.id ? saved : g))))
    );
  };

  const handleJoinNetworkGroup = (groupId: string) => {
    const myMemberId = currentUser?.id || 'user-self';
    setNetworkGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const alreadyIn = g.memberIds.includes(myMemberId);
        return {
          ...g,
          memberIds: alreadyIn
            ? g.memberIds.filter((m) => m !== myMemberId)
            : [...g.memberIds, myMemberId],
        };
      })
    );
    syncRemote('Participação no grupo não guardada', () =>
      api
        .toggleGroupMembership(groupId)
        .then(({ group }) => setNetworkGroups((prev) => prev.map((g) => (g.id === group.id ? group : g))))
    );
  };

  const handleVisionComplete = (data: any) => {
    setVisionData(data);
  };

  const handleInjectBulkSamples = (partials: Partial<GeologicalSample>[]) => {
    const normalized: GeologicalSample[] = partials.map((p, index) => {
      const target: PlanetaryTarget = p.targetPlanet || selectedSite.targetPlanet || 'Mars';
      const refSite = sites.find((s) => s.id === p.siteId) || selectedSite;
      const unmeasured = new Set(p.unmeasured || []);
      const placeholders: string[] = [];

      // Values the file did not contain get neutral placeholders that are flagged as
      // unmeasured: the AFI ignores them and the notes say so explicitly.
      const coordinates = p.coordinates || refSite.coordinates;
      if (!p.coordinates) {
        unmeasured.add('coordinates');
        placeholders.push(`coordenadas do sítio de referência (${refSite.name})`);
      }
      const waterActivity = p.waterActivity ?? refSite.waterActivityAw;
      if (p.waterActivity === undefined) {
        unmeasured.add('waterActivity');
        placeholders.push(`aw típica do sítio (${refSite.waterActivityAw})`);
      }
      const pH = p.pH ?? 7;
      if (p.pH === undefined) {
        unmeasured.add('pH');
        placeholders.push('pH 7 (neutro, não medido)');
      }
      const minerals = p.minerals || {};
      if (Object.keys(minerals).length === 0) unmeasured.add('minerals');

      const base = {
        targetPlanet: target,
        waterActivity,
        pH,
        depthCm: p.depthCm ?? 0,
        porosityPercent: p.porosityPercent ?? 0,
        minerals,
        unmeasured: [...unmeasured],
      };
      const notesSuffix = placeholders.length
        ? `\n[Não medido no ficheiro — valores provisórios: ${placeholders.join('; ')}.]`
        : '';

      const sample: GeologicalSample = {
        ...base,
        id: p.id || `smp-imp-${Date.now()}-${index}`,
        name: p.name || `Amostra importada #${index + 1}`,
        siteId: p.siteId && sites.some((s) => s.id === p.siteId) ? p.siteId : refSite.id,
        collaboratorId: p.collaboratorId || currentUser?.id,
        collectorName: p.collectorName || currentUser?.name || 'Não indicado',
        institution: p.institution || currentUser?.institution || 'Não indicada',
        collectedAt: p.collectedAt || new Date().toISOString().split('T')[0],
        coordinates,
        rockClassification: p.rockClassification || 'Não classificada',
        xrfComposition: p.xrfComposition || {},
        fidelityScores: computeAnalogueFidelity(base, target, refSite),
        spectralCurve: generateSpectralReflectanceCurve(minerals),
        fieldNotes: (p.fieldNotes || 'Importado de ficheiro CSV/JSON.') + notesSuffix,
        version: p.version || 'v1.0.0-import',
        publishedAt: new Date().toISOString(),
        hash: '',
        status: 'draft',
        officialSource: p.officialSource || 'Ficheiro importado pelo utilizador',
        peerComments: [],
      };
      return { ...sample, hash: computeSampleFingerprint(sample) };
    });
    for (const s of normalized) {
      syncRemote('Estudo importado não publicado', () =>
        api.saveSample(s).then((saved) => setSamples((prev) => prev.map((x) => (x.id === saved.id ? saved : x))))
      );
    }

    if (normalized.length > 0) {
      setSamples((prev) => {
        const existingNames = new Set(prev.map((item) => item.name.toLowerCase()));
        const uniqueIncoming = normalized.filter((item) => !existingNames.has(item.name.toLowerCase()));
        return [...uniqueIncoming, ...prev];
      });
      setActiveSample(normalized[0]);
    }
  };

  const handleAddPeerComment = (sampleId: string, commentText: string, endorse?: boolean) => {
    // Only signed-in researchers can comment; endorsement rules live in services/peerReview.
    if (!currentUser) return;
    const target = samples.find((s) => s.id === sampleId);
    const mayEndorse = Boolean(endorse && target && endorseBlockReason(target, currentUser.id) === null);
    const newComment: PeerComment = {
      id: `c-${Date.now()}`,
      sampleId,
      author: currentUser ? `${currentUser.name} (${currentUser.codename})` : 'Pesquisador Colaborador',
      authorId: currentUser?.id,
      role: currentUser?.role || 'Investigador Planetário',
      institution: currentUser?.institution || 'African Analogs Collaborative',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16) + ' UTC',
      content: commentText,
      statusChange: mayEndorse ? 'approved' : undefined,
    };

    setSamples((prev) =>
      prev.map((s) => {
        if (s.id === sampleId) {
          const updated = { ...s, peerComments: [...(s.peerComments || []), newComment] };
          return { ...updated, status: reviewStatus(updated) };
        }
        return s;
      })
    );
    syncRemote('Comentário não publicado no servidor', () =>
      api
        .addComment(sampleId, {
          content: commentText,
          endorse: mayEndorse,
          author: newComment.author,
          role: newComment.role,
          institution: newComment.institution,
        })
        .then((saved) => setSamples((prev) => prev.map((s) => (s.id === saved.id ? saved : s))))
    );
  };

  const handleCompareWithActive = (peerSample: GeologicalSample) => {
    setSelectedSite(sites.find((s) => s.id === peerSample.siteId) || selectedSite);
    setActiveSample(peerSample);
    setActiveTab('research_workspace');
  };

  const handleNewAnalysis = () => {
    const blank: GeologicalSample = {
      id: `smp-${Date.now().toString(36)}`,
      name: '',
      siteId: selectedSite.id,
      customLocation: '',
      collaboratorId: currentUser?.id,
      collectorName: currentUser?.name || '',
      institution: currentUser?.institution || '',
      collectedAt: new Date().toISOString().slice(0, 10),
      coordinates: selectedSite.coordinates,
      depthCm: 0,
      rockClassification: 'Não classificada',
      targetPlanet: selectedSite.targetPlanet,
      waterActivity: 0,
      pH: 7,
      porosityPercent: 0,
      minerals: {},
      xrfComposition: {},
      fidelityScores: computeAnalogueFidelity({}, selectedSite.targetPlanet, selectedSite),
      spectralCurve: generateSpectralReflectanceCurve({}),
      fieldNotes: '',
      version: 'v1.0.0-manual',
      hash: '',
      status: 'draft',
      officialSource: 'Registo manual do pesquisador',
      peerComments: [],
      unmeasured: ['waterActivity', 'pH', 'depthCm', 'porosityPercent', 'minerals', 'xrfComposition'],
    };
    setActiveSample(blank);
    setVisionData(null);
    setAttachedDiagnostics(null);
    setActiveTab('research_workspace');
  };

  const handleUpdateAiSnapshot = (patch: Partial<LatestAiAnalysisSnapshot>) => {
    setLatestAiAnalysis((prev) => ({
      targetPlanet: patch.targetPlanet || prev?.targetPlanet || activeSample.targetPlanet,
      ...prev,
      ...patch,
      updatedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }));
  };

  const handleOpenPublishFromAi = () => {
    setPublishTriggerCount((c) => c + 1);
    setActiveTab('account_profile');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] flex flex-col font-sans transition-colors duration-150">
      <a href="#main-content" className="skip-link">
        Pular para o conteúdo principal
      </a>

      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onNewAnalysis={handleNewAnalysis}
        totalPeerSamples={samples.length}
        currentUser={currentUser}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-[1680px] mx-auto px-3 sm:px-5 lg:px-6 py-5 sm:py-6 focus:outline-none">
        <Suspense fallback={<TabFallback />}>
        {activeTab === 'research_workspace' && (
          <UnifiedResearchWorkspace
            sites={sites}
            selectedSite={selectedSite}
            activeSample={activeSample}
            currentUser={currentUser}
            visionData={visionData}
            attachedDiagnostics={attachedDiagnostics}
            latestAiAnalysis={latestAiAnalysis}
            onSelectSite={setSelectedSite}
            onSaveSample={handleSaveSample}
            onInjectBulkSamples={handleInjectBulkSamples}
            onVisionComplete={handleVisionComplete}
            onAttachDiagnostics={(text) => setAttachedDiagnostics(text)}
            onUpdateAiSnapshot={handleUpdateAiSnapshot}
            onOpenPublishFromAi={handleOpenPublishFromAi}
            onStartNewAnalysis={handleNewAnalysis}
          />
        )}

        {activeTab === 'peer_network' && (
          <ResearcherCollaborationFeed
            collaborators={allCollaborators}
            sites={sites}
            samples={samples}
            activeSample={activeSample}
            currentUser={currentUser}
            focusedCollaboratorId={focusedCollaboratorId}
            focusedStudyId={focusedStudyId}
            onFocusCollaborator={(id) => {
              setFocusedStudyId(null);
              setFocusedCollaboratorId(id);
            }}
            onFocusStudy={(id) => {
              setFocusedCollaboratorId(null);
              setFocusedStudyId(id);
            }}
            connectedIds={connectedIds}
            directThreads={directThreads}
            studyThreads={studyThreads}
            networkGroups={networkGroups}
            onToggleConnect={handleToggleConnect}
            onSendDirectMessage={handleSendDirectMessage}
            onSendStudyMessage={handleSendStudyMessage}
            onCreateNetworkGroup={handleCreateNetworkGroup}
            onJoinNetworkGroup={handleJoinNetworkGroup}
            onSelectSample={(smp) => {
              setActiveSample(smp);
              const found = sites.find((s) => s.id === smp.siteId);
              if (found) setSelectedSite(found);
            }}
            onAddPeerComment={handleAddPeerComment}
            onCompareWithActive={handleCompareWithActive}
          />
        )}

        {activeTab === 'account_profile' && (
          <AccountEcosystemView
            currentUser={currentUser}
            accounts={accounts}
            sites={sites}
            samples={samples}
            activeSample={activeSample}
            latestAiAnalysis={latestAiAnalysis}
            publishTriggerCount={publishTriggerCount}
            connectedIds={connectedIds}
            activeNetworkCount={networkGroups.length}
            studyThreads={studyThreads}
            networkGroups={networkGroups}
            onRegister={handleRegisterAccount}
            onLogin={handleLoginAccount}
            onUpdateProfile={handleUpdateDynamicProfile}
            onUpdatePassword={handleUpdatePassword}
            onLogout={handleLogout}
            onPublishStudy={handlePublishStudyFromProfile}
            onDeleteOwnSample={handleDeleteOwnSample}
            onOpenSampleInResearch={handleCompareWithActive}
            onOpenMyProfileInNetwork={(pid) => {
              setFocusedStudyId(null);
              setFocusedCollaboratorId(pid);
              setActiveTab('peer_network');
            }}
          />
        )}
        </Suspense>
      </main>

      {syncNotice && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[1300] max-w-[calc(100%-2rem)] px-4 py-2.5 rounded-xl bg-[#0F172A] dark:bg-[#F0F6FC] text-[#F8FAFC] dark:text-[#0F172A] text-sm shadow-lg"
        >
          {syncNotice}
        </div>
      )}

      <footer className="mt-auto py-4 px-3 sm:px-5 lg:px-6 bg-[#FFFFFF] dark:bg-[#161B22] text-xs text-[#475569] dark:text-[#94A3B8] transition-colors duration-150">
        <div className="w-full max-w-[1680px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-poppins font-semibold text-[#0F172A] dark:text-[#F0F6FC]">African Analogs</span>
            <span aria-hidden="true">·</span>
            <span>Lugares na Terra parecidos com outros planetas</span>
          </div>
          <div>
            Dados públicos NASA · Aberto para todos
          </div>
        </div>
      </footer>
    </div>
  );
}
