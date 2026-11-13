import React, { useEffect, useMemo, useState } from 'react';
import { Navigation, CleanMenuTab } from './components/Navigation';
import { UnifiedResearchWorkspace } from './components/UnifiedResearchWorkspace';
import { ResearcherCollaborationFeed } from './components/ResearcherCollaborationFeed';
import { AccountEcosystemView } from './components/AccountEcosystemView';

import {
  ANALOGUE_SITES,
  COLLABORATORS,
  INITIAL_COLLABORATOR_THREADS,
  INITIAL_NETWORK_GROUPS,
  INITIAL_SAMPLES,
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
import {
  authenticateLocalAccount,
  createLocalAccountRecord,
  fetchServerLocalState,
  hashPasswordSha256,
  loadLocalWorkspaceState,
  persistAccountsAndProfiles,
  persistWorkspaceCollections,
  RegisterAccountInput,
} from './services/localAccountStore';

export default function App() {
  const initialLocal = useMemo(() => loadLocalWorkspaceState(), []);

  const [activeTab, setActiveTab] = useState<CleanMenuTab>('research_workspace');
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
  const [focusedCollaboratorId, setFocusedCollaboratorId] = useState<string | null>(null);

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

  // Hydrate from server local JSON backup if browser localStorage was empty
  useEffect(() => {
    if (initialLocal.accounts.length > 0 || (initialLocal.samples && initialLocal.samples.length > 0)) {
      return;
    }
    let mounted = true;
    fetchServerLocalState().then((remote) => {
      if (!mounted || !remote) return;
      if (Array.isArray(remote.accounts) && remote.accounts.length > 0) {
        setAccounts(remote.accounts);
      }
      if (Array.isArray(remote.customProfiles) && remote.customProfiles.length > 0) {
        setCustomProfiles(remote.customProfiles);
      }
      if (Array.isArray(remote.samples) && remote.samples.length > 0) {
        setSamples(remote.samples);
      }
      if (Array.isArray(remote.networkGroups) && remote.networkGroups.length > 0) {
        setNetworkGroups(remote.networkGroups);
      }
    });
    return () => {
      mounted = false;
    };
  }, [initialLocal.accounts.length, initialLocal.samples]);

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
    const { account, profile } = await createLocalAccountRecord(input, accounts, allCollaborators);
    setAccounts((prev) => [account, ...prev]);
    setCustomProfiles((prev) => [profile, ...prev]);
    setSessionUserId(profile.id);
  };

  const handleLoginAccount = async (identifier: string, password: string) => {
    const matched = await authenticateLocalAccount(identifier, password, accounts);
    setSessionUserId(matched.profileId);
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
      setSamples((prev) =>
        prev.map((s) =>
          s.collaboratorId === profileId
            ? {
                ...s,
                collectorName: patch.name || s.collectorName,
                institution: patch.institution || s.institution,
              }
            : s
        )
      );
    }
  };

  const handleUpdatePassword = async (
    accountId: string,
    currentPassword: string,
    newPassword: string
  ) => {
    const acc = accounts.find((a) => a.id === accountId);
    if (!acc) throw new Error('Conta não encontrada.');
    const curHash = await hashPasswordSha256(currentPassword);
    if (curHash !== acc.passwordHash) {
      throw new Error('Senha atual incorreta.');
    }
    if (newPassword.length < 6) {
      throw new Error('A nova senha deve ter no mínimo 6 caracteres.');
    }
    const newHash = await hashPasswordSha256(newPassword);
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === accountId ? { ...a, passwordHash: newHash, updatedAt: new Date().toISOString() } : a
      )
    );
  };

  const handleLogout = () => {
    setSessionUserId(null);
  };

  const handlePublishStudyFromProfile = (newStudy: GeologicalSample) => {
    setSamples((prev) => [newStudy, ...prev.filter((s) => s.id !== newStudy.id)]);
    setActiveSample(newStudy);
  };

  const handleDeleteOwnSample = (sampleId: string) => {
    setSamples((prev) => prev.filter((s) => s.id !== sampleId));
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
  };

  const handleCreateNetworkGroup = (group: ResearchNetworkGroup) => {
    setNetworkGroups((prev) => [group, ...prev]);
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
  };

  const handleVisionComplete = (data: any) => {
    setVisionData(data);
  };

  const handleInjectBulkSamples = (partials: Partial<GeologicalSample>[]) => {
    const normalized: GeologicalSample[] = partials.map((p, index) => {
      const target: PlanetaryTarget = p.targetPlanet || 'Mars';
      const minerals = p.minerals || { 'Silicatos Basálticos': 60, 'Óxidos de Ferro': 25, 'Sulfatos': 15 };
      const fidelityScores = computeAnalogueFidelity(
        {
          targetPlanet: target,
          waterActivity: p.waterActivity ?? 0.35,
          pH: p.pH ?? 7.0,
          depthCm: p.depthCm ?? 5.0,
          porosityPercent: p.porosityPercent ?? 18.0,
          minerals,
        },
        target
      );

      return {
        id: p.id || `smp-imp-${Date.now()}-${index}`,
        name: p.name || `Amostra Oficial #${index + 1}`,
        siteId: p.siteId || selectedSite.id,
        collaboratorId: p.collaboratorId || currentUser?.id,
        collectorName: p.collectorName || currentUser?.name || 'Equipe Colaborativa',
        institution: p.institution || currentUser?.institution || 'Rede African Analogs',
        collectedAt: p.collectedAt || new Date().toISOString().split('T')[0],
        coordinates: p.coordinates || selectedSite.coordinates,
        depthCm: p.depthCm ?? 5.0,
        rockClassification: p.rockClassification || 'Regolito / Evaporito Análogo',
        targetPlanet: target,
        waterActivity: p.waterActivity ?? 0.35,
        pH: p.pH ?? 7.0,
        porosityPercent: p.porosityPercent ?? 18.0,
        minerals,
        xrfComposition: p.xrfComposition || { SiO2: 50.0, Fe2O3: 16.0, Al2O3: 14.0 },
        fidelityScores,
        spectralCurve: generateSpectralReflectanceCurve(minerals),
        fieldNotes: p.fieldNotes || 'Importado via arquivo oficial CSV/JSON.',
        version: p.version || 'v1.0.0-pds',
        hash: p.hash || '0x' + Math.random().toString(16).substring(2, 16),
        status: 'under_review',
        officialSource: p.officialSource || 'Importação Científica Verificada (CSV/JSON)',
        peerComments: [],
      };
    });

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
    const newComment: PeerComment = {
      id: `c-${Date.now()}`,
      sampleId,
      author: currentUser ? `${currentUser.name} (${currentUser.codename})` : 'Pesquisador Colaborador',
      role: currentUser?.role || 'Investigador Planetário',
      institution: currentUser?.institution || 'African Analogs Collaborative',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16) + ' UTC',
      content: commentText,
      statusChange: endorse ? 'approved' : undefined,
    };

    setSamples((prev) =>
      prev.map((s) => {
        if (s.id === sampleId) {
          const updatedComments = [...(s.peerComments || []), newComment];
          return {
            ...s,
            status: endorse ? ('verified_peer_reviewed' as const) : s.status,
            peerComments: updatedComments,
          };
        }
        return s;
      })
    );
  };

  const handleCompareWithActive = (peerSample: GeologicalSample) => {
    setSelectedSite(sites.find((s) => s.id === peerSample.siteId) || selectedSite);
    setActiveSample(peerSample);
    setActiveTab('research_workspace');
  };

  const handleNewAnalysis = () => {
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
            onSaveSample={(updated) => {
              setActiveSample(updated);
              setSamples((prev) => [updated, ...prev.filter((s) => s.id !== updated.id)]);
            }}
            onInjectBulkSamples={handleInjectBulkSamples}
            onVisionComplete={handleVisionComplete}
            onAttachDiagnostics={(text) => setAttachedDiagnostics(text)}
            onUpdateAiSnapshot={handleUpdateAiSnapshot}
            onOpenPublishFromAi={handleOpenPublishFromAi}
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
            onRegister={handleRegisterAccount}
            onLogin={handleLoginAccount}
            onUpdateProfile={handleUpdateDynamicProfile}
            onUpdatePassword={handleUpdatePassword}
            onLogout={handleLogout}
            onPublishStudy={handlePublishStudyFromProfile}
            onDeleteOwnSample={handleDeleteOwnSample}
            onOpenSampleInResearch={handleCompareWithActive}
            onOpenMyProfileInNetwork={(pid) => {
              setFocusedCollaboratorId(pid);
              setActiveTab('peer_network');
            }}
          />
        )}
      </main>

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
