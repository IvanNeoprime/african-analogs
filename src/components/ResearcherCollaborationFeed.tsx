import { getSampleText, getSiteText } from '../data/siteTranslations';
import { getLocale, useI18n } from '../i18n';
import React, { useMemo, useState } from 'react';
import { ContributionGraph } from './ContributionGraph';
import { collectContributions } from '../services/contributions';
import { studyLink } from '../services/links';
import {
  AnalogueSite,
  CollaboratorProfile,
  DirectResearchMessage,
  GeologicalSample,
  PlanetaryTarget,
  ResearchNetworkGroup,
  ResearchTimelineStep,
} from '../types';
import {
  DWARF_PLANET_BODIES,
  getCelestialBodyLabel,
  PLANET_BODIES,
  SATELLITE_BODIES,
  bodyName,
  bodyFullName,
} from '../data/celestialBodies';
import { endorseBlockReason, REQUIRED_ENDORSEMENTS, validEndorserIds } from '../services/peerReview';
import {
  Search,
  MessageSquare,
  Share2,
  Check,
  CheckCircle2,
  ArrowRight,
  UserPlus,
  UserCheck,
  Globe2,
  BookOpen,
  Send,
  RefreshCw,
  Database,
  FileText,
  Clock,
  Network,
  Plus,
  Download,
  Printer,
  Sparkles,
  Users,
  Link2,
  ExternalLink,
} from 'lucide-react';

import { HARDCODED_API_ENDPOINTS } from '../services/officialApis';

interface ResearcherCollaborationFeedProps {
  collaborators: CollaboratorProfile[];
  sites: AnalogueSite[];
  samples: GeologicalSample[];
  activeSample: GeologicalSample;
  currentUser?: CollaboratorProfile | null;
  focusedCollaboratorId?: string | null;
  connectedIds: string[];
  directThreads: Record<string, DirectResearchMessage[]>;
  studyThreads: Record<string, DirectResearchMessage[]>;
  networkGroups: ResearchNetworkGroup[];
  onToggleConnect: (collaboratorId: string) => void;
  onSendDirectMessage: (collaboratorId: string, message: DirectResearchMessage) => void;
  onSendStudyMessage: (sampleId: string, message: DirectResearchMessage) => void;
  onCreateNetworkGroup: (group: ResearchNetworkGroup) => void;
  onJoinNetworkGroup: (groupId: string) => void;
  onSelectSample: (sample: GeologicalSample) => void;
  onAddPeerComment: (sampleId: string, comment: string, endorse?: boolean) => void;
  onCompareWithActive: (peerSample: GeologicalSample) => void;
  /** Study to open (from the page address, e.g. #/comunidade/estudo/<id>). */
  focusedStudyId?: string | null;
  /** Report navigation so the page address can be updated and shared. */
  onFocusCollaborator?: (collaboratorId: string | null) => void;
  onFocusStudy?: (sampleId: string) => void;
}

/** "2026-04-02" → "2 abr 2026" */
const formatDay = (value: string | undefined) => {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return value || '';
  return new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00`).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');
};

/** Text colour for a similarity value: low values must not look "good". */
const similarityTone = (value: number) =>
  value >= 70
    ? 'text-[#15803D] dark:text-[#4ADE80]'
    : value >= 40
    ? 'text-[#B45309] dark:text-[#FBBF24]'
    : 'text-[#B91C1C] dark:text-[#F87171]';


const englishDemoProfileText = new Map<string, string>(Object.entries({
  "Demo · Astrobiologia de Dallol": "Demo · Dallol Astrobiology",
  "Astrobiologia (demo)": "Astrobiology (demo)",
  "Perfil de demonstração (fictício)": "Fictional demonstration profile",
  "Etiópia": "Ethiopia",
  "Evaporitos hiperácidos, salmouras caotrópicas e limites físico-químicos da vida": "Highly acidic evaporites, chaotropic brines and physicochemical limits of life",
  "Perfil fictício de demonstração — não representa nenhuma pessoa real. Tema: Evaporitos hiperácidos e salmouras de Dallol como análogos de Marte e Vénus.": "Fictional demonstration profile. Research topic: highly acidic evaporites and brines at Dallol as analogues for Mars and Venus.",
  "Demo · Geologia de Impacto": "Demo · Impact Geology",
  "Geologia de impacto (demo)": "Impact geology (demo)",
  "África do Sul": "South Africa",
  "Metamorfismo de choque, brechas de fusão e estruturas multi-anéis": "Shock metamorphism, melt breccias and multi-ring structures",
  "Perfil fictício de demonstração — não representa nenhuma pessoa real. Tema: Metamorfismo de choque em Vredefort como análogo de regolito lunar.": "Fictional demonstration profile. Research topic: shock metamorphism at Vredefort as a lunar regolith analogue.",
  "Demo · Geoquímica do Rift": "Demo · Rift Geochemistry",
  "Geoquímica (demo)": "Geochemistry (demo)",
  "Tanzânia": "Tanzania",
  "Lagos soda-alcalinos, carbonatitos e plumas oceânicas de Encélado": "Soda lakes, carbonatites and the ocean plumes of Enceladus",
  "Perfil fictício de demonstração — não representa nenhuma pessoa real. Tema: Lagos soda-alcalinos (Natron) como análogos do oceano de Encélado.": "Fictional demonstration profile. Research topic: soda lakes such as Lake Natron as analogues for the ocean of Enceladus.",
  "Demo · Hiperaridez e Espectroscopia": "Demo · Hyperaridity and Spectroscopy",
  "Espectroscopia (demo)": "Spectroscopy (demo)",
  "Percloratos naturais, biofilmes endolíticos e espectrometria SWIR": "Natural perchlorates, endolithic biofilms and SWIR spectrometry",
  "Perfil fictício de demonstração — não representa nenhuma pessoa real. Tema: Hiperaridez, percloratos e espectroscopia SWIR no Atacama.": "Fictional demonstration profile. Research topic: hyperaridity, perchlorates and SWIR spectroscopy in the Atacama.",
  "Demo · Geomorfologia Eólica": "Demo · Aeolian Geomorphology",
  "Geomorfologia eólica (demo)": "Aeolian geomorphology (demo)",
  "Namíbia": "Namibia",
  "Dunas lineares gigantes, dinâmica eólica e espectros de óxidos férricos": "Giant linear dunes, wind dynamics and iron oxide spectra",
  "Perfil fictício de demonstração — não representa nenhuma pessoa real. Tema: Dunas lineares do Namibe como análogos das dunas de Titã e Marte.": "Fictional demonstration profile. Research topic: linear dunes in the Namib as analogues for dunes on Titan and Mars."
}));

const englishDemoMessages: Partial<Record<string, Pick<DirectResearchMessage, 'timestamp' | 'content'>>> = {
  "msg-cav-1": {
    "timestamp": "Today · 09:40 UTC",
    "content": "The new XRD spectra for the Dallol terraces (DNK-DAL-01 and DNK-VEN-02) are available. If your team is comparing jarosite or altered basalt data for Mars or Venus, share your parameters here."
  },
  "msg-rei-1": {
    "timestamp": "Yesterday · 16:15 UTC",
    "content": "We are comparing thin sections of Vredefort pseudotachylyte with Apollo 14 breccias. Connect with us to discuss shock metamorphism."
  },
  "msg-jum-1": {
    "timestamp": "Yesterday · 11:20 UTC",
    "content": "Seasonal Lake Natron measurements at pH 10.5 are available for modelling Enceladus’s plumes. I’m happy to discuss sampling protocols."
  },
  "msg-var-1": {
    "timestamp": "2 days ago",
    "content": "I shared the ATACAMA-PAL-04 dataset, with magnesium perchlorate and water activity of 0.27, for comparison with African deserts."
  },
  "msg-men-1": {
    "timestamp": "Today · 08:10 UTC",
    "content": "Grain-size profiles for the Namib’s linear dunes are ready for radar backscatter calibration for Titan (Dragonfly) and Mars."
  }
};

const englishDemoGroups: Partial<Record<string, Pick<ResearchNetworkGroup, 'title' | 'objective'>>> = {
  "net-mars-evaporites": {
    "title": "Afar–Atacama Consortium: Martian Evaporites",
    "objective": "Compare SWIR spectra and water activity limits at Dallol and Salar de Pajonales for Perseverance rover calibration."
  },
  "net-moon-impact": {
    "title": "Vredefort–Artemis Network: Breccias & Lunar Regolith",
    "objective": "Map shock metamorphism, ilmenite and impact melts analogous to those at Shackleton Crater."
  },
  "net-ocean-worlds": {
    "title": "Ocean Worlds Group: East African Rift & Enceladus",
    "objective": "Study the geochemistry of alkaline carbonate lakes such as Lake Natron to model cryovolcanic plumes."
  },
  "net-titan-aeolian": {
    "title": "Namib–Titan Aeolian Network (Dragonfly)",
    "objective": "Study giant linear dune dynamics and the transport of organic and iron-rich sediments."
  }
};

const formatMessageTime = (d: Date) =>
  d.toLocaleString(getLocale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

const AvatarWithFallback: React.FC<{
  src: string;
  name: string;
  sizeClass?: string;
}> = ({ src, name, sizeClass = 'w-11 h-11' }) => {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(' ')
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  if (failed || !src) {
    return (
      <div
        aria-hidden="true"
        className={`${sizeClass} rounded-full bg-[#1E3A8A] dark:bg-[#2563EB] text-[#FFFFFF] font-semibold text-xs flex items-center justify-center shrink-0`}
      >
        {initials || 'AA'}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`Foto de perfil de ${name}`}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${sizeClass} rounded-full object-cover bg-[#F1F5F9] dark:bg-[#21262D] shrink-0`}
    />
  );
};

export const ResearcherCollaborationFeed: React.FC<ResearcherCollaborationFeedProps> = ({
  collaborators: rawCollaborators,
  sites,
  samples,
  activeSample,
  currentUser,
  focusedCollaboratorId,
  connectedIds,
  directThreads,
  studyThreads,
  networkGroups,
  onToggleConnect,
  onSendDirectMessage,
  onSendStudyMessage,
  onCreateNetworkGroup,
  onJoinNetworkGroup,
  onSelectSample,
  onAddPeerComment,
  onCompareWithActive,
  focusedStudyId,
  onFocusCollaborator,
  onFocusStudy,
}) => {
  const { t, lang } = useI18n();
  const collaborators = useMemo(() => lang === 'en' ? rawCollaborators.map((profile) => {
    if (profile.institution !== 'Perfil de demonstração (fictício)') return profile;
    const fields = ["name","role","institution","country","specialty","bio"] as const;
    const localized = { ...profile };
    for (const field of fields) localized[field] = englishDemoProfileText.get(profile[field]) ?? profile[field];
    return localized;
  }) : rawCollaborators, [rawCollaborators, lang]);
  const [workspaceView, setWorkspaceView] = useState<'profiles' | 'network'>('profiles');
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string | 'ALL'>(
    focusedCollaboratorId || collaborators[0]?.id || 'ALL'
  );

  React.useEffect(() => {
    if (focusedCollaboratorId && collaborators.some((c) => c.id === focusedCollaboratorId)) {
      setSelectedCollaboratorId(focusedCollaboratorId);
      setWorkspaceView('profiles');
      setHistoryScope('profile');
    }
  }, [focusedCollaboratorId, rawCollaborators]);
  const [selectedPlanet, setSelectedPlanet] = useState<'ALL' | PlanetaryTarget>('ALL');
  const [historyScope, setHistoryScope] = useState<'profile' | 'all_past'>('profile');
  const [collaboratorSearch, setCollaboratorSearch] = useState('');
  const [studySearchQuery, setStudySearchQuery] = useState('');

  const [activeSampleDetail, setActiveSampleDetail] = useState<GeologicalSample>(
    samples.find((s) => s.collaboratorId === collaborators[0]?.id) || samples[0] || activeSample
  );

  // Study Bento Sub-Tab: Bate-Papo | Visão de Dados | Visão do Relatório | Linha do Tempo & Conclusões
  const [studyTab, setStudyTab] = useState<'chat' | 'data' | 'report' | 'timeline'>('chat');

  // Study Chat & Peer Review States
  const [studyChatInput, setStudyChatInput] = useState('');
  const [isStudyReplying, setIsStudyReplying] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [endorsed, setEndorsed] = useState(false);
  const [contributionNotice, setContributionNotice] = useState<string | null>(null);

  // Direct Researcher Chat (Profile Header)
  const [directInput, setDirectInput] = useState('');
  const [isDirectReplying, setIsDirectReplying] = useState(false);

  // Study Report AI Synthesis State
  const [generatedStudyReports, setGeneratedStudyReports] = useState<Record<string, string>>({});
  const [isGeneratingStudyReport, setIsGeneratingStudyReport] = useState(false);
  const [studyReportError, setStudyReportError] = useState<string | null>(null);
  const [copiedCitation, setCopiedCitation] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Network Builder Form States
  const [networkTitle, setNetworkTitle] = useState('');
  const [networkTarget, setNetworkTarget] = useState<PlanetaryTarget>('Mars');
  const [networkObjective, setNetworkObjective] = useState('');
  const [networkSelectedMembers, setNetworkSelectedMembers] = useState<string[]>(connectedIds);
  const [networkNotice, setNetworkNotice] = useState<string | null>(null);

  React.useEffect(() => {
    const updated = samples.find((s) => s.id === activeSampleDetail.id);
    if (updated) {
      setActiveSampleDetail(updated);
    }
  }, [samples, activeSampleDetail.id]);

  const activeCollaborator =
    selectedCollaboratorId === 'ALL'
      ? collaborators.find(
          (c) =>
            c.id === activeSampleDetail.collaboratorId || rawCollaborators.some((raw) => raw.id === c.id && raw.name === activeSampleDetail.collectorName)
        ) || null
      : collaborators.find((c) => c.id === selectedCollaboratorId) || null;

  const filteredCollaborators = collaborators.filter((c) => {
    const q = collaboratorSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.codename.toLowerCase().includes(q) ||
      c.specialty.toLowerCase().includes(q) ||
      c.institution.toLowerCase().includes(q)
    );
  });

  const publicResearches = useMemo(() => {
    const q = studySearchQuery.trim().toLowerCase();
    return samples.filter((s) => {
      const planetOk = selectedPlanet === 'ALL' || s.targetPlanet === selectedPlanet;
      if (!planetOk) return false;
      const scopeOk =
        historyScope === 'all_past' || selectedCollaboratorId === 'ALL'
          ? true
          : s.collaboratorId === selectedCollaboratorId ||
            rawCollaborators.find((c) => c.id === selectedCollaboratorId)?.name === s.collectorName;
      if (!scopeOk) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) || getSampleText(s, 'name').toLowerCase().includes(q) ||
        (s.customLocation || '').toLowerCase().includes(q) ||
        s.collectorName.toLowerCase().includes(q) ||
        Object.keys(s.minerals || {}).some((m) => m.toLowerCase().includes(q))
      );
    });
  }, [samples, selectedPlanet, historyScope, selectedCollaboratorId, rawCollaborators, studySearchQuery, lang]);

  const studyDetailRef = React.useRef<HTMLElement>(null);

  const openStudy = (smp: GeologicalSample, scroll = true) => {
    setActiveSampleDetail(smp);
    onSelectSample(smp);
    onFocusStudy?.(smp.id);
    if (scroll) {
      requestAnimationFrame(() => studyDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };

  // Open the study named in the page address (shared link, Back/Forward).
  React.useEffect(() => {
    if (!focusedStudyId || focusedStudyId === activeSampleDetail.id) return;
    const smp = samples.find((s) => s.id === focusedStudyId);
    if (smp) {
      setActiveSampleDetail(smp);
      setWorkspaceView('profiles');
      setHistoryScope('all_past');
      // Show the study's author in the profile card.
      const author = collaborators.find((c) => c.id === smp.collaboratorId || c.name === smp.collectorName);
      if (author) setSelectedCollaboratorId(author.id);
      requestAnimationFrame(() => studyDetailRef.current?.scrollIntoView({ block: 'start' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedStudyId, samples]);

  const handleSelectCollaborator = (colId: string | 'ALL') => {
    onFocusCollaborator?.(colId === 'ALL' ? null : colId);
    setSelectedCollaboratorId(colId);
    setWorkspaceView('profiles');
    if (colId === 'ALL') {
      setHistoryScope('all_past');
      return;
    }
    setHistoryScope('profile');
    const colObj = collaborators.find((c) => c.id === colId);
    const matchingSample = samples.find(
      (s) => s.collaboratorId === colId || (colObj && s.collectorName === colObj.name)
    );
    if (matchingSample) {
      setActiveSampleDetail(matchingSample);
      onSelectSample(matchingSample);
    }
  };

  // Timeline of what actually happened to the study: its own recorded steps if any,
  // otherwise registration + real dated review comments. Nothing is generated.
  const studyTimeline: ResearchTimelineStep[] = useMemo(() => {
    if (activeSampleDetail.timeline && activeSampleDetail.timeline.length > 0) {
      return activeSampleDetail.timeline;
    }
    const steps: ResearchTimelineStep[] = [
      {
        id: 'tl-registered',
        stage: 'Estudo registado na plataforma',
        timestamp: formatDay(activeSampleDetail.publishedAt || activeSampleDetail.collectedAt),
        author: activeSampleDetail.collectorName,
        detail: `Amostra colhida em ${formatDay(activeSampleDetail.collectedAt)} · fonte: ${getSampleText(activeSampleDetail, 'officialSource')}.`,
        status: 'completed',
      },
    ];
    for (const c of activeSampleDetail.peerComments || []) {
      steps.push({
        id: `tl-${c.id}`,
        stage: c.statusChange === 'approved' ? t("Endosso de revisor", "Reviewer endorsement") : t("Comentário de revisão", "Review comment"),
        timestamp: formatDay(c.timestamp),
        author: c.author,
        detail: c.content,
        status: 'completed',
      });
    }
    const endorsements = validEndorserIds(activeSampleDetail).length;
    steps.push({
      id: 'tl-validation',
      stage: t("Validação pela comunidade", "Community validation"),
      timestamp: endorsements >= REQUIRED_ENDORSEMENTS ? t("Concluída", "Complete") : t("Em curso", "In progress"),
      author: 'Regra da plataforma',
      detail: t(`${endorsements} de ${REQUIRED_ENDORSEMENTS} endossos independentes necessários.`, `${endorsements} of ${REQUIRED_ENDORSEMENTS} independent endorsements required.`),
      status: endorsements >= REQUIRED_ENDORSEMENTS ? 'completed' : 'in_progress',
    });
    return steps;
  }, [activeSampleDetail, t]);

  const studyConclusionText = useMemo(() => {
    if (activeSampleDetail.conclusion) return activeSampleDetail.conclusion;
    const f = activeSampleDetail.fidelityScores;
    const coverage = typeof f.coverage === 'number' ? t(` (dados medidos cobrem ${Math.round(f.coverage * 100)}% dos critérios)`, ` (measurements cover ${Math.round(f.coverage * 100)}% of the criteria)`) : '';
    return t(`O autor ainda não escreveu uma conclusão. Semelhança calculada com ${getCelestialBodyLabel(activeSampleDetail.targetPlanet)}: ${f.total}%${coverage}.`, `The author has yet to write a conclusion. Calculated similarity to ${getCelestialBodyLabel(activeSampleDetail.targetPlanet)}: ${f.total}%${coverage}.`);
  }, [activeSampleDetail]);

  const studyReportSite = sites.find((s) => s.id === activeSampleDetail.siteId) || sites[0];

  const handleSendChatToResearcher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCollaborator || !directInput.trim()) return;

    const text = directInput.trim();
    setDirectInput('');

    if (!connectedIds.includes(activeCollaborator.id)) {
      onToggleConnect(activeCollaborator.id);
    }

    onSendDirectMessage(activeCollaborator.id, {
      id: `dm-${Date.now()}`,
      collaboratorId: activeCollaborator.id,
      sender: 'user',
      senderName: currentUser ? `${currentUser.name} (${currentUser.codename})` : 'Você (Pesquisador)',
      senderId: currentUser?.id,
      timestamp: formatMessageTime(new Date()),
      sentAt: new Date().toISOString(),
      content: text,
    });

    if (currentUser && activeCollaborator.id === currentUser.id) {
      return;
    }

    // Never let the AI speak on behalf of a real registered person.
    if (activeCollaborator.isLocalRegistered) {
      return;
    }

    setIsDirectReplying(true);
    try {
      const response = await fetch(HARDCODED_API_ENDPOINTS.BACKEND_CHAT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lang,
          prompt: `És o copiloto de IA da plataforma (não és uma pessoa e não deves fingir ser). O utilizador escreveu ao perfil de demonstração "${activeCollaborator.name}" (tema: ${activeCollaborator.specialty}): "${text}". Responde como assistente, de forma breve (2-4 frases), objetiva e em ${lang === 'en' ? 'inglês' : 'português'}, sem inventar dados, medições ou colaborações.`,
          targetPlanet: activeCollaborator.focusPlanets[0] || 'Mars',
          activeSample: activeSampleDetail,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.reply) {
          onSendDirectMessage(activeCollaborator.id, {
            id: `dm-rep-${Date.now()}`,
            collaboratorId: activeCollaborator.id,
            sender: 'researcher',
            senderName: 'Copiloto IA (resposta automática)',
            timestamp: formatMessageTime(new Date()),
            sentAt: new Date().toISOString(),
            content: data.reply,
          });
        }
      }
    } catch {
      // Keep user message saved locally
    } finally {
      setIsDirectReplying(false);
    }
  };

  // Dedicated Study Chat Handler
  const handleSendStudyChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studyChatInput.trim()) return;

    const text = studyChatInput.trim();
    setStudyChatInput('');

    const leadCollaborator =
      collaborators.find(
        (c) =>
          c.id === activeSampleDetail.collaboratorId || c.name === activeSampleDetail.collectorName
      ) || collaborators[0];

    onSendStudyMessage(activeSampleDetail.id, {
      id: `st-${Date.now()}`,
      collaboratorId: leadCollaborator.id,
      sender: 'user',
      senderName: currentUser ? `${currentUser.name} (${currentUser.codename})` : 'Você (Co-investigador)',
      senderId: currentUser?.id,
      timestamp: formatMessageTime(new Date()),
      sentAt: new Date().toISOString(),
      content: text,
    });

    if (currentUser && activeSampleDetail.collaboratorId === currentUser.id) {
      return;
    }

    setIsStudyReplying(true);
    try {
      const response = await fetch(HARDCODED_API_ENDPOINTS.BACKEND_CHAT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lang,
          prompt: `És o copiloto de IA da plataforma (não és o autor do estudo e não deves fingir ser uma pessoa). No espaço de discussão do estudo "${getSampleText(activeSampleDetail, 'name')}" (Alvo: ${activeSampleDetail.targetPlanet}, AFI: ${activeSampleDetail.fidelityScores.total}%, aw: ${activeSampleDetail.waterActivity}, pH: ${activeSampleDetail.pH}), um colaborador escreveu: "${text}". Responde como assistente, em ${lang === 'en' ? 'inglês' : 'português'}, de forma técnica e breve (2-4 frases), sem inventar dados.`,
          targetPlanet: activeSampleDetail.targetPlanet,
          activeSample: activeSampleDetail,
          siteContext: studyReportSite,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.reply) {
          onSendStudyMessage(activeSampleDetail.id, {
            id: `st-rep-${Date.now()}`,
            collaboratorId: leadCollaborator.id,
            sender: 'researcher',
            senderName: 'Copiloto IA (resposta automática)',
            timestamp: formatMessageTime(new Date()),
            sentAt: new Date().toISOString(),
            content: data.reply,
          });
        }
      }
    } catch {
      // Preserve message
    } finally {
      setIsStudyReplying(false);
    }
  };

  const endorseBlock = endorseBlockReason(activeSampleDetail, currentUser?.id);
  const endorsementCount = validEndorserIds(activeSampleDetail).length;

  const handlePostContribution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newComment.trim() || !activeSampleDetail) return;
    onAddPeerComment(activeSampleDetail.id, newComment.trim(), endorsed && endorseBlock === null);
    setNewComment('');
    setEndorsed(false);
    setContributionNotice(t(`Contribuição científica registrada em "${getSampleText(activeSampleDetail, 'name')}".`, `Contribution recorded for “${getSampleText(activeSampleDetail, 'name')}”.`));
    setTimeout(() => setContributionNotice(null), 4000);
  };

  const handleGenerateStudyReport = async () => {
    setIsGeneratingStudyReport(true);
    setStudyReportError(null);
    try {
      const response = await fetch(HARDCODED_API_ENDPOINTS.BACKEND_REPORT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lang,
          sample: activeSampleDetail,
          site: studyReportSite,
          targetPlanet: activeSampleDetail.targetPlanet,
          investigator: activeSampleDetail.collectorName,
          attachedDiagnostics: studyConclusionText,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Erro HTTP ${response.status}`);
      }
      const data = await response.json();
      setGeneratedStudyReports((prev) => ({ ...prev, [activeSampleDetail.id]: data.report }));
    } catch (err: any) {
      setStudyReportError(err.message || t("Falha ao gerar relatório da pesquisa.", "Could not generate the research report."));
    } finally {
      setIsGeneratingStudyReport(false);
    }
  };

  const handleCopyCitation = (sample: GeologicalSample) => {
    const citation = `${sample.collectorName} (${sample.collectedAt.split('-')[0]}). "${sample.name}". African Analogs. ${sample.officialSource}. ${studyLink(sample.id)} (${sample.hash}).`;
    navigator.clipboard.writeText(citation);
    setCopiedCitation(sample.id);
    setTimeout(() => setCopiedCitation(null), 2500);
  };

  const handleDownloadStudyMarkdown = () => {
    const body =
      generatedStudyReports[activeSampleDetail.id] ||
      `# ${getSampleText(activeSampleDetail, 'name')}\n\n- Pesquisador: ${activeSampleDetail.collectorName} (${activeSampleDetail.institution})\n- Alvo: ${activeSampleDetail.targetPlanet}\n- AFI: ${activeSampleDetail.fidelityScores.total}%\n- aw: ${activeSampleDetail.waterActivity} | pH: ${activeSampleDetail.pH}\n\n## Notas de Campo\n${getSampleText(activeSampleDetail, 'fieldNotes')}\n\n## Conclusões\n${studyConclusionText}`;
    const blob = new Blob([body], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activeSampleDetail.id}_Relatorio_African_Analogs.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCreateNewNetwork = (e: React.FormEvent) => {
    e.preventDefault();
    if (!networkTitle.trim() || !networkObjective.trim()) return;
    const newGroup: ResearchNetworkGroup = {
      id: `net-${Date.now()}`,
      title: networkTitle.trim(),
      targetPlanet: networkTarget,
      objective: networkObjective.trim(),
      memberIds: Array.from(new Set([currentUser?.id || 'user-self', ...networkSelectedMembers])),
      createdBy: currentUser?.id,
      createdAt: new Date().toISOString().split('T')[0],
    };
    onCreateNetworkGroup(newGroup);
    setNetworkTitle('');
    setNetworkObjective('');
    setNetworkNotice(`Grupo "${newGroup.title}" criado com ${newGroup.memberIds.length} membros.`);
    setTimeout(() => setNetworkNotice(null), 4000);
  };

  // GitHub-style activity: computed from real, dated actions only.
  const contributionSources = useMemo(
    () => ({ samples, studyThreads, networkGroups }),
    [samples, studyThreads, networkGroups]
  );
  const activeContributions = useMemo(
    () => (activeCollaborator ? collectContributions(activeCollaborator, contributionSources) : []),
    [activeCollaborator, contributionSources]
  );
  const pointsByCollaborator = useMemo(() => {
    const map = new Map<string, number>();
    for (const col of collaborators) {
      map.set(col.id, collectContributions(col, contributionSources).reduce((sum, e) => sum + e.points, 0));
    }
    return map;
  }, [collaborators, contributionSources]);

  const isConnected = activeCollaborator ? connectedIds.includes(activeCollaborator.id) : false;
  const activeDirectThread = (activeCollaborator ? directThreads[activeCollaborator.id] || [] : []).map((message) => {
    const translation = lang === 'en' ? englishDemoMessages[message.id] : undefined;
    return translation ? { ...message, ...translation, senderName: englishDemoProfileText.get(message.senderName) ?? message.senderName } : message;
  });
  const activeStudyThread = studyThreads[activeSampleDetail.id] || [];
  const currentStudyReportText = generatedStudyReports[activeSampleDetail.id];

  return (
    <div className="space-y-5">
      {/* Bento Top Header + View Switcher (Pessoas e Pesquisas | Grupos de Estudo) */}
      <div className="bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors duration-150">
        <div>
          <h1 className="font-poppins text-2xl font-bold text-[#0F172A] dark:text-[#F0F6FC] tracking-tight">
            {t("Comunidade & Colaboradores", "Community and Collaborators")}
          </h1>
          <p className="text-sm text-[#475569] dark:text-[#94A3B8] mt-1">
            {t("Veja pesquisas já feitas, converse sobre cada estudo, confira os dados e participe de grupos de estudo.", "Browse research, discuss studies, review their data and join study groups.")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="text-xs text-[#475569] dark:text-[#94A3B8] bg-[#F1F5F9] dark:bg-[#21262D] px-3.5 py-2 rounded-xl">
            <strong className="font-mono text-[#0F172A] dark:text-[#F0F6FC] tabular-nums">{samples.length}</strong> pesquisas ·{' '}
            <strong className="font-mono text-[#0F172A] dark:text-[#F0F6FC] tabular-nums">{connectedIds.length}</strong> conexões ·{' '}
            <strong className="font-mono text-[#0F172A] dark:text-[#F0F6FC] tabular-nums">{networkGroups.length}</strong> grupos
          </div>

          <div role="tablist" aria-label={t("Modo de visualização", "View mode")} className="flex items-center gap-1 p-1 bg-[#F1F5F9] dark:bg-[#0D1117] rounded-xl">
            <button
              type="button"
              role="tab"
              aria-selected={workspaceView === 'profiles'}
              onClick={() => setWorkspaceView('profiles')}
              className={`min-h-[36px] py-1.5 px-3.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                workspaceView === 'profiles'
                  ? 'bg-[#FFFFFF] dark:bg-[#21262D] text-[#1E3A8A] dark:text-[#60A5FA] font-semibold shadow-xs'
                  : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F0F6FC]'
              }`}
            >
              <Users className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
              <span>{t("Pessoas e Pesquisas", "People and Research")}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={workspaceView === 'network'}
              onClick={() => setWorkspaceView('network')}
              className={`min-h-[36px] py-1.5 px-3.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                workspaceView === 'network'
                  ? 'bg-[#FFFFFF] dark:bg-[#21262D] text-[#1E3A8A] dark:text-[#60A5FA] font-semibold shadow-xs'
                  : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F0F6FC]'
              }`}
            >
              <Network className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
              <span>{t("Grupos de Estudo", "Study Groups")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Split: Left Content (8 cols) + Right Collaborators Directory (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT WORKSPACE */}
        <div className="lg:col-span-8 space-y-5 order-1">
          {workspaceView === 'network' ? (
            /* ======================== RESEARCH NETWORK VIEW ======================== */
            <div className="space-y-5">
              {/* Bento 1: Interactive Research Network Graph */}
              <section
                aria-labelledby="network-graph-heading"
                className="bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-6 shadow-xs space-y-4 transition-colors duration-150"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 id="network-graph-heading" className="font-poppins text-base font-bold text-[#0F172A] dark:text-[#F0F6FC] flex items-center gap-2">
                      <Network className="w-4 h-4 text-[#1E3A8A] dark:text-[#60A5FA]" strokeWidth={1.75} aria-hidden="true" />
                      <span>{t("Sua Rede de Contatos", "Your Network")}</span>
                    </h2>
                    <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-0.5">
                      {t("Veja quem está conectado com você e clique em uma pessoa para abrir o perfil dela.", "Select a connection to open their profile.")}
                    </p>
                  </div>
                  <span className="text-xs font-medium bg-[#F1F5F9] dark:bg-[#21262D] text-[#1E3A8A] dark:text-[#60A5FA] px-3 py-1 rounded-xl">
                    {connectedIds.length} conectados
                  </span>
                </div>

                <div className="bg-[#F8FAFC] dark:bg-[#0D1117] rounded-xl p-4 overflow-x-auto">
                  <svg viewBox="0 0 640 240" className="w-full h-auto" role="img" aria-label={t("Mapa de conexões entre pessoas", "Map of connections between people")}>
                    {/* Center Hub: Você */}
                    {collaborators.map((col, idx) => {
                      const angle = ((idx - (collaborators.length - 1) / 2) * Math.PI) / 4.2;
                      const cx = 320 + Math.sin(angle) * 210;
                      const cy = 125 - Math.cos(angle) * 80;
                      const isColConnected = connectedIds.includes(col.id);
                      return (
                        <g key={col.id} className="cursor-pointer" onClick={() => handleSelectCollaborator(col.id)}>
                          <line
                            x1="320"
                            y1="145"
                            x2={cx}
                            y2={cy}
                            className={
                              isColConnected
                                ? 'stroke-[#1E3A8A] dark:stroke-[#60A5FA]'
                                : 'stroke-[#CBD5E1] dark:stroke-[#30363D]'
                            }
                            strokeWidth={isColConnected ? 2.2 : 1.2}
                            strokeDasharray={isColConnected ? undefined : '4 4'}
                          />
                          <circle
                            cx={cx}
                            cy={cy}
                            r="20"
                            className={
                              isColConnected
                                ? 'fill-[#1E3A8A] dark:fill-[#2563EB]'
                                : 'fill-[#FFFFFF] dark:fill-[#161B22]'
                            }
                          />
                          <text
                            x={cx}
                            y={cy + 3}
                            textAnchor="middle"
                            className={`text-[9px] font-bold ${
                              isColConnected ? 'fill-[#FFFFFF]' : 'fill-[#0F172A] dark:fill-[#F0F6FC]'
                            }`}
                          >
                            {col.codename.slice(1, 5).toUpperCase()}
                          </text>
                          <text
                            x={cx}
                            y={cy + 33}
                            textAnchor="middle"
                            className="fill-[#0F172A] dark:fill-[#F0F6FC] text-[10px] font-medium"
                          >
                            {col.name.replace('Dra. ', '').replace('Prof. ', '').replace('Dr. ', '')}
                          </text>
                          <text
                            x={cx}
                            y={cy + 45}
                            textAnchor="middle"
                            className="fill-[#475569] dark:fill-[#94A3B8] text-[8.5px]"
                          >
                            {col.focusPlanets.join(' · ')}
                          </text>
                        </g>
                      );
                    })}

                    {/* Center Node */}
                    <circle cx="320" cy="145" r="28" className="fill-[#0F766E] dark:fill-[#10B981]" />
                    <text x="320" y="149" textAnchor="middle" className="fill-[#FFFFFF] text-[10px] font-bold">
                      {t("VOCÊ", "YOU")}
                    </text>
                  </svg>
                </div>
              </section>

              {/* Bento 2: Create New Study Group */}
              <section
                aria-labelledby="create-network-heading"
                className="bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-6 shadow-xs space-y-4 transition-colors duration-150"
              >
                <h2 id="create-network-heading" className="font-poppins text-base font-bold text-[#0F172A] dark:text-[#F0F6FC] flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#1E3A8A] dark:text-[#60A5FA]" strokeWidth={1.75} aria-hidden="true" />
                  <span>{t("Criar Novo Grupo de Estudo", "Create a Study Group")}</span>
                </h2>

                {networkNotice && (
                  <div aria-live="polite" className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-xs text-[#15803D] dark:text-[#4ADE80] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                    <span>{networkNotice}</span>
                  </div>
                )}

                <form onSubmit={handleCreateNewNetwork} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="net-title" className="text-xs font-medium text-[#475569] dark:text-[#94A3B8] block mb-1">
                        {t("Nome do Grupo", "Group Name")}
                      </label>
                      <input
                        id="net-title"
                        type="text"
                        required
                        value={networkTitle}
                        onChange={(e) => setNetworkTitle(e.target.value)}
                        placeholder={t("Ex.: Rede Danakil–Jezero de Sulfatos", "E.g. Danakil–Jezero Sulfate Network")}
                        className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-sm px-3.5 py-2 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
                      />
                    </div>

                    <div>
                      <label htmlFor="net-planet" className="text-xs font-medium text-[#475569] dark:text-[#94A3B8] block mb-1">
                        {t("Planeta ou Lua do Grupo", "Group Planet or Moon")}
                      </label>
                      <select
                        id="net-planet"
                        value={networkTarget}
                        onChange={(e) => setNetworkTarget(e.target.value as PlanetaryTarget)}
                        className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-sm px-3.5 py-2 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
                      >
                        <optgroup label={t("Planetas do Sistema Solar", "Solar System Planets")}>
                          {PLANET_BODIES.map((b) => (
                            <option key={b.id} value={b.id}>
                              {bodyName(b)}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label={t("Planetas Anões", "Dwarf Planets")}>
                          {DWARF_PLANET_BODIES.map((b) => (
                            <option key={b.id} value={b.id}>
                              {bodyName(b)}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label={t("Satélites Naturais (Luas)", "Natural Satellites (Moons)")}>
                          {SATELLITE_BODIES.map((b) => (
                            <option key={b.id} value={b.id}>
                              {bodyFullName(b)}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="net-objective" className="text-xs font-medium text-[#475569] dark:text-[#94A3B8] block mb-1">
                      {t("O que o grupo vai estudar?", "What will the group study?")}
                    </label>
                    <textarea
                      id="net-objective"
                      rows={2}
                      required
                      value={networkObjective}
                      onChange={(e) => setNetworkObjective(e.target.value)}
                      placeholder={t("Descreva em poucas palavras o tema do grupo...", "Briefly describe the group’s topic...")}
                      className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-sm p-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
                    />
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-medium text-[#475569] dark:text-[#94A3B8] block">
                      {t("Convidar pessoas para este grupo", "Invite people to this group")}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {collaborators.map((col) => {
                        const checked = networkSelectedMembers.includes(col.id);
                        return (
                          <button
                            key={col.id}
                            type="button"
                            aria-pressed={checked}
                            onClick={() =>
                              setNetworkSelectedMembers((prev) =>
                                prev.includes(col.id) ? prev.filter((id) => id !== col.id) : [...prev, col.id]
                              )
                            }
                            className={`py-1.5 px-3 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                              checked
                                ? 'bg-[#1E3A8A] dark:bg-[#2563EB] text-[#FFFFFF]'
                                : 'bg-[#F1F5F9] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC]'
                            }`}
                          >
                            <AvatarWithFallback src={col.avatarUrl} name={col.name} sizeClass="w-5 h-5" />
                            <span>{col.name.replace('Dra. ', '').replace('Prof. ', '').replace('Dr. ', '')}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="min-h-[40px] py-2 px-5 bg-[#1E3A8A] dark:bg-[#2563EB] hover:bg-[#1E40AF] dark:hover:bg-[#1D4ED8] text-[#FFFFFF] text-sm font-medium rounded-xl transition-colors cursor-pointer"
                  >
                    {t("Criar Grupo", "Create Group")}
                  </button>
                </form>
              </section>

              {/* Bento 3: Active Study Groups List */}
              <section
                aria-labelledby="active-networks-heading"
                className="bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-6 shadow-xs space-y-4 transition-colors duration-150"
              >
                <h2 id="active-networks-heading" className="font-poppins text-base font-bold text-[#0F172A] dark:text-[#F0F6FC]">
                  Grupos Ativos ({networkGroups.length})
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {networkGroups.map((group) => {
                    const myMemberId = currentUser?.id || 'user-self';
                    const isMember = group.memberIds.includes(myMemberId);
                    const members = collaborators.filter((c) => group.memberIds.includes(c.id));
                    return (
                      <div key={group.id} className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117] flex flex-col justify-between space-y-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[#1E3A8A] dark:text-[#60A5FA] font-semibold">{getCelestialBodyLabel(group.targetPlanet)}</span>
                            <span className="text-[#475569] dark:text-[#94A3B8]">{group.createdAt}</span>
                          </div>
                          <h3 className="font-poppins text-sm font-bold text-[#0F172A] dark:text-[#F0F6FC]">{(lang === 'en' ? englishDemoGroups[group.id]?.title : undefined) ?? group.title}</h3>
                          <p className="text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed">{(lang === 'en' ? englishDemoGroups[group.id]?.objective : undefined) ?? group.objective}</p>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2">
                          <div className="flex items-center -space-x-2">
                            {members.map((m) => (
                              <AvatarWithFallback key={m.id} src={m.avatarUrl} name={m.name} sizeClass="w-7 h-7" />
                            ))}
                            <span className="pl-3 text-[11px] text-[#475569] dark:text-[#94A3B8]">
                              {group.memberIds.length} pessoas
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => onJoinNetworkGroup(group.id)}
                            className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                              isMember
                                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-[#15803D] dark:text-[#4ADE80]'
                                : 'bg-[#1E3A8A] dark:bg-[#2563EB] text-[#FFFFFF]'
                            }`}
                          >
                            {isMember ? 'Participando' : 'Entrar no Grupo'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          ) : (
            /* ======================== PROFILES & STUDIES WORKSPACE ======================== */
            <>
              {/* BENTO 1: Selected Collaborator Profile + Connect + Direct Chat */}
              {activeCollaborator && (
                <section
                  aria-labelledby="collaborator-profile-name"
                  className="bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-6 shadow-xs space-y-4 transition-colors duration-150"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <AvatarWithFallback
                        src={activeCollaborator.avatarUrl}
                        name={activeCollaborator.name}
                        sizeClass="w-16 h-16"
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-medium text-[#1E3A8A] dark:text-[#60A5FA]">
                            {activeCollaborator.codename}
                          </span>
                          <span aria-hidden="true" className="text-[#CBD5E1] dark:text-[#484F58]">·</span>
                          <span className="text-[#475569] dark:text-[#94A3B8]">{activeCollaborator.country}</span>
                        </div>
                        <h2 id="collaborator-profile-name" className="font-poppins text-xl font-bold text-[#0F172A] dark:text-[#F0F6FC] mt-0.5">
                          {activeCollaborator.name}
                        </h2>
                        <div className="text-sm text-[#475569] dark:text-[#94A3B8]">
                          {activeCollaborator.role} · {activeCollaborator.institution}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        aria-pressed={isConnected}
                        onClick={() => onToggleConnect(activeCollaborator.id)}
                        className={`min-h-[40px] py-2 px-4 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                          isConnected
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-[#15803D] dark:text-[#4ADE80]'
                            : 'bg-[#1E3A8A] dark:bg-[#2563EB] hover:bg-[#1E40AF] dark:hover:bg-[#1D4ED8] text-[#FFFFFF]'
                        }`}
                      >
                        {isConnected ? (
                          <>
                            <UserCheck className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                            <span>{t("Conectado", "Connected")}</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                            <span>{t("Conectar", "Connect")}</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setWorkspaceView('network')}
                        className="min-h-[40px] py-2 px-3.5 bg-[#F1F5F9] dark:bg-[#21262D] hover:bg-[#E2E8F0] dark:hover:bg-[#30363D] text-[#0F172A] dark:text-[#F0F6FC] text-xs font-medium rounded-xl flex items-center gap-1.5 cursor-pointer"
                      >
                        <Network className="w-4 h-4 text-[#1E3A8A] dark:text-[#60A5FA]" strokeWidth={1.75} aria-hidden="true" />
                        <span>{t("Ver Grupos", "View Groups")}</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-[#0F172A] dark:text-[#E2E8F0] leading-relaxed">
                    {activeCollaborator.bio}
                  </p>

                  <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#30363D]">
                    <ContributionGraph
                      events={activeContributions}
                      ownerLabel={activeCollaborator.name}
                      isSelf={Boolean(currentUser && currentUser.id === activeCollaborator.id)}
                    />
                  </div>

                  {/* Compact Direct Profile Conversation */}
                  <details className="bg-[#F8FAFC] dark:bg-[#0D1117] rounded-xl p-3.5">
                    <summary className="text-xs font-semibold text-[#1E3A8A] dark:text-[#60A5FA] cursor-pointer flex items-center justify-between select-none">
                      <span>{t('Enviar mensagem direta para', 'Send a direct message to')} {activeCollaborator.name} ({activeDirectThread.length})</span>
                      <span className="text-[#475569] dark:text-[#94A3B8] font-normal">{t("Abrir conversa", "Open conversation")}</span>
                    </summary>

                    <div className="mt-3 space-y-2.5">
                      <div aria-live="polite" className="max-h-40 overflow-y-auto space-y-2">
                        {activeDirectThread.map((msg) => (
                          <div
                            key={msg.id}
                            className={`p-2.5 rounded-xl text-xs leading-relaxed ${
                              msg.sender === 'user'
                                ? 'bg-[#1E3A8A] dark:bg-[#2563EB] text-[#FFFFFF] ml-6'
                                : 'bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#E2E8F0] mr-6 shadow-xs'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] opacity-80 mb-0.5">
                              <strong>{msg.senderName}</strong>
                              <span className="font-mono">{msg.timestamp}</span>
                            </div>
                            <p>{msg.content}</p>
                          </div>
                        ))}
                        {isDirectReplying && (
                          <div className="flex items-center gap-2 text-xs text-[#475569] dark:text-[#94A3B8] p-1">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#1E3A8A]" strokeWidth={1.75} />
                            <span>{t("Copiloto IA a responder…", "AI Copilot is replying…")}</span>
                          </div>
                        )}
                      </div>

                      <form onSubmit={handleSendChatToResearcher} className="flex gap-2">
                        <input
                          type="text"
                          aria-label={t(`Mensagem direta para ${activeCollaborator.name}`, `Direct message to ${activeCollaborator.name}`)}
                          value={directInput}
                          onChange={(e) => setDirectInput(e.target.value)}
                          placeholder={t(`Escreva uma mensagem para ${activeCollaborator.name}...`, `Write a message to ${activeCollaborator.name}...`)}
                          className="flex-1 min-w-0 bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#F0F6FC] text-xs px-3 py-2 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
                        />
                        <button
                          type="submit"
                          disabled={!directInput.trim() || isDirectReplying}
                          className="py-2 px-3.5 bg-[#1E3A8A] dark:bg-[#2563EB] disabled:opacity-50 text-[#FFFFFF] text-xs font-medium rounded-xl flex items-center gap-1 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" strokeWidth={1.75} />
                          <span>{t("Enviar", "Send")}</span>
                        </button>
                      </form>
                    </div>
                  </details>
                </section>
              )}

              {/* BENTO 2: List of Previously Completed Researches */}
              <section
                aria-labelledby="public-studies-heading"
                className="bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-6 shadow-xs space-y-4 transition-colors duration-150"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#1E3A8A] dark:text-[#60A5FA]" strokeWidth={1.75} aria-hidden="true" />
                    <h3 id="public-studies-heading" className="font-poppins text-sm sm:text-base font-bold text-[#0F172A] dark:text-[#F0F6FC]">
                      Estudos ({publicResearches.length})
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 p-1 bg-[#F1F5F9] dark:bg-[#0D1117] rounded-xl text-xs">
                      <button
                        type="button"
                        onClick={() => setHistoryScope('profile')}
                        className={`py-1 px-2.5 rounded-lg font-medium transition-colors cursor-pointer ${
                          historyScope === 'profile'
                            ? 'bg-[#FFFFFF] dark:bg-[#21262D] text-[#1E3A8A] dark:text-[#60A5FA] shadow-xs'
                            : 'text-[#475569] dark:text-[#94A3B8]'
                        }`}
                      >
                        {t("Desta Pessoa", "By This Person")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryScope('all_past')}
                        className={`py-1 px-2.5 rounded-lg font-medium transition-colors cursor-pointer ${
                          historyScope === 'all_past'
                            ? 'bg-[#FFFFFF] dark:bg-[#21262D] text-[#1E3A8A] dark:text-[#60A5FA] shadow-xs'
                            : 'text-[#475569] dark:text-[#94A3B8]'
                        }`}
                      >
                        Todas ({samples.length})
                      </button>
                    </div>

                    <select
                      aria-label={t("Filtrar pesquisas anteriores por planeta ou satélite", "Filter previous research by planet or moon")}
                      value={selectedPlanet}
                      onChange={(e) => setSelectedPlanet(e.target.value as 'ALL' | PlanetaryTarget)}
                      className="bg-[#F1F5F9] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-xs font-medium px-3 py-1.5 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
                    >
                      <option value="ALL">{t("Todos Planetas e Luas", "All Planets and Moons")}</option>
                      <optgroup label={t("Planetas do Sistema Solar", "Solar System Planets")}>
                        {PLANET_BODIES.map((b) => (
                          <option key={b.id} value={b.id}>
                            {bodyName(b)}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label={t("Planetas Anões", "Dwarf Planets")}>
                        {DWARF_PLANET_BODIES.map((b) => (
                          <option key={b.id} value={b.id}>
                            {bodyName(b)}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label={t("Satélites Naturais (Luas)", "Natural Satellites (Moons)")}>
                        {SATELLITE_BODIES.map((b) => (
                          <option key={b.id} value={b.id}>
                            {bodyFullName(b)}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.75} aria-hidden="true" />
                  <input
                    type="text"
                    aria-label={t("Buscar pesquisas por título, lugar ou autor", "Search research by title, site or author")}
                    value={studySearchQuery}
                    onChange={(e) => setStudySearchQuery(e.target.value)}
                    placeholder={t("Buscar pesquisa por título, lugar, mineral ou autor...", "Search research by title, site, mineral or author...")}
                    className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] placeholder:text-[#94A3B8] text-xs pl-8 pr-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                  />
                </div>

                {publicResearches.length === 0 ? (
                  <div className="p-8 rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117] text-center text-sm text-[#475569] dark:text-[#94A3B8]">
                    {t("Nenhuma pesquisa encontrada para este filtro.", "No research matches this filter.")}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {publicResearches.map((smp) => {
                      const isSelected = activeSampleDetail.id === smp.id;
                      const commentsCount = (smp.peerComments?.length || 0) + (studyThreads[smp.id]?.length || 0);
                      return (
                        <button
                          key={smp.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => openStudy(smp)}
                          className={`w-full text-left p-4 rounded-xl transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] ${
                            isSelected
                              ? 'bg-[#F1F5F9] dark:bg-[#21262D] shadow-xs'
                              : 'bg-[#F8FAFC] dark:bg-[#0D1117] hover:bg-[#F1F5F9] dark:hover:bg-[#1C2128]'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-semibold text-[#1E3A8A] dark:text-[#60A5FA]">
                              {getCelestialBodyLabel(smp.targetPlanet)} · {formatDay(smp.collectedAt)}
                            </span>
                            <span
                              className={`font-mono font-semibold tabular-nums ${similarityTone(smp.fidelityScores.total)}`}
                              title={t(`Semelhança calculada com ${getCelestialBodyLabel(smp.targetPlanet)}`, `Calculated similarity to ${getCelestialBodyLabel(smp.targetPlanet)}`)}
                            >
                              {smp.fidelityScores.total}%
                            </span>
                          </div>
                          <div className="text-sm font-semibold text-[#0F172A] dark:text-[#F0F6FC] line-clamp-1">
                            {getSampleText(smp, 'name')}
                          </div>
                          <div className="flex items-center justify-between text-xs text-[#475569] dark:text-[#94A3B8] mt-1.5 gap-2">
                            <span className="truncate">
                              {smp.customLocation || sites.find((s) => s.id === smp.siteId)?.name || smp.collectorName} · {smp.collectorName}
                            </span>
                            <span className="flex items-center gap-1 font-mono shrink-0">
                              <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                              <span>{commentsCount}</span>
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* BENTO 3: Selected Research Workspace (Conversa | Dados | Resumo | Etapas & Conclusão) */}
              <section
                ref={studyDetailRef}
                aria-labelledby="study-detail-heading"
                className="bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-6 shadow-xs space-y-5 transition-colors duration-150"
              >
                {/* Study Header */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-[#475569] dark:text-[#94A3B8]">
                      <span className="font-semibold text-[#1E3A8A] dark:text-[#60A5FA]">
                        {t('Análogo de', 'Analogue of')} {getCelestialBodyLabel(activeSampleDetail.targetPlanet)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{getSampleText(activeSampleDetail, 'officialSource')}</span>
                    </div>

                    {activeSampleDetail.status === 'verified_peer_reviewed' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#15803D] dark:text-[#4ADE80] bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                        <span>Validado por {endorsementCount} revisores</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#B45309] dark:text-[#FBBF24] bg-amber-50 dark:bg-amber-950/50 px-2.5 py-0.5 rounded-lg">
                        <span>
                          Em revisão · {endorsementCount}/{REQUIRED_ENDORSEMENTS} endossos
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 id="study-detail-heading" className="font-poppins text-xl font-bold text-[#0F172A] dark:text-[#F0F6FC]">
                        {getSampleText(activeSampleDetail, 'name')}
                      </h3>
                      <p className="text-xs sm:text-sm text-[#475569] dark:text-[#94A3B8]">
                        Lugar: <strong className="text-[#0F172A] dark:text-[#F0F6FC]">{activeSampleDetail.customLocation || getSiteText(studyReportSite, 'name')}</strong> · Publicado por{' '}
                        {(() => {
                          const author = collaborators.find(
                            (c) => c.id === activeSampleDetail.collaboratorId || c.name === activeSampleDetail.collectorName
                          );
                          return author ? (
                            <a
                              href={`#/comunidade/pessoa/${encodeURIComponent(author.id)}`}
                              onClick={(e) => {
                                e.preventDefault();
                                handleSelectCollaborator(author.id);
                              }}
                              className="font-semibold text-[#1E3A8A] dark:text-[#60A5FA] underline underline-offset-2"
                            >
                              {activeSampleDetail.collectorName}
                            </a>
                          ) : (
                            <strong className="text-[#0F172A] dark:text-[#F0F6FC]">{activeSampleDetail.collectorName}</strong>
                          );
                        })()}{' '}
                        ({activeSampleDetail.institution}) · {formatDay(activeSampleDetail.collectedAt)}
                      </p>
                      {studyReportSite.references?.[0] && (
                        <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-1">
                          {t("Referência do sítio:", "Site reference:")}{' '}
                          <a
                            href={studyReportSite.references[0].url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#1E3A8A] dark:text-[#60A5FA] underline underline-offset-2 inline-flex items-center gap-1"
                          >
                            {studyReportSite.references[0].citation.split('(')[0].trim()} ({studyReportSite.references[0].citation.match(/\((\d{4})\)/)?.[1]})
                            <ExternalLink className="w-3 h-3" strokeWidth={1.75} aria-hidden="true" />
                            <span className="sr-only">{t("(abre noutro separador)", "(opens in another tab)")}</span>
                          </a>
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onCompareWithActive(activeSampleDetail)}
                      className="min-h-[38px] py-1.5 px-3.5 bg-[#F1F5F9] dark:bg-[#21262D] hover:bg-[#E2E8F0] dark:hover:bg-[#30363D] text-[#0F172A] dark:text-[#F0F6FC] text-xs font-medium rounded-xl flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <span>{t("Comparar com a minha amostra", "Compare with my sample")}</span>
                      <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(studyLink(activeSampleDetail.id));
                        setCopiedLink(activeSampleDetail.id);
                        setTimeout(() => setCopiedLink(null), 2500);
                      }}
                      className="min-h-[38px] py-1.5 px-3.5 bg-[#F1F5F9] dark:bg-[#21262D] hover:bg-[#E2E8F0] dark:hover:bg-[#30363D] text-[#0F172A] dark:text-[#F0F6FC] text-xs font-medium rounded-xl flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      {copiedLink === activeSampleDetail.id ? (
                        <Check className="w-3.5 h-3.5 text-[#15803D]" strokeWidth={1.75} aria-hidden="true" />
                      ) : (
                        <Link2 className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                      )}
                      <span aria-live="polite">{copiedLink === activeSampleDetail.id ? 'Link copiado' : 'Copiar link'}</span>
                    </button>
                  </div>
                </div>

                {/* 4-Compartment Bento Study Switcher */}
                <div
                  role="tablist"
                  aria-label={t("Seções da pesquisa selecionada", "Selected study sections")}
                  className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 bg-[#F1F5F9] dark:bg-[#0D1117] rounded-xl"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={studyTab === 'chat'}
                    onClick={() => setStudyTab('chat')}
                    className={`min-h-[38px] py-1.5 px-2.5 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      studyTab === 'chat'
                        ? 'bg-[#FFFFFF] dark:bg-[#21262D] text-[#1E3A8A] dark:text-[#60A5FA] font-semibold shadow-xs'
                        : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F0F6FC]'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    <span>{t("Conversa", "Discussion")}</span>
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={studyTab === 'data'}
                    onClick={() => setStudyTab('data')}
                    className={`min-h-[38px] py-1.5 px-2.5 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      studyTab === 'data'
                        ? 'bg-[#FFFFFF] dark:bg-[#21262D] text-[#1E3A8A] dark:text-[#60A5FA] font-semibold shadow-xs'
                        : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F0F6FC]'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    <span>{t("Dados", "Data")}</span>
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={studyTab === 'report'}
                    onClick={() => setStudyTab('report')}
                    className={`min-h-[38px] py-1.5 px-2.5 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      studyTab === 'report'
                        ? 'bg-[#FFFFFF] dark:bg-[#21262D] text-[#1E3A8A] dark:text-[#60A5FA] font-semibold shadow-xs'
                        : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F0F6FC]'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    <span>{t("Resumo", "Summary")}</span>
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={studyTab === 'timeline'}
                    onClick={() => setStudyTab('timeline')}
                    className={`min-h-[38px] py-1.5 px-2.5 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      studyTab === 'timeline'
                        ? 'bg-[#FFFFFF] dark:bg-[#21262D] text-[#1E3A8A] dark:text-[#60A5FA] font-semibold shadow-xs'
                        : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F0F6FC]'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    <span>{t("Etapas & Conclusão", "Steps and Conclusion")}</span>
                  </button>
                </div>

                {/* -------- TAB 1: CONVERSA DA PESQUISA -------- */}
                {studyTab === 'chat' && (
                  <div className="space-y-5">
                    <div className="bg-[#F8FAFC] dark:bg-[#0D1117] rounded-xl p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-[#0F172A] dark:text-[#F0F6FC]">
                          Bate-papo · {getSampleText(activeSampleDetail, 'name')}
                        </span>
                        <span className="text-[#475569] dark:text-[#94A3B8]">
                          Com {activeSampleDetail.collectorName}
                        </span>
                      </div>

                      <div aria-live="polite" className="max-h-60 overflow-y-auto space-y-2.5 pr-1">
                        {activeStudyThread.length === 0 ? (
                          <div className="p-4 rounded-xl bg-[#FFFFFF] dark:bg-[#161B22] text-xs text-[#475569] dark:text-[#94A3B8]">
                            Tire dúvidas ou converse com o autor sobre <strong className="text-[#0F172A] dark:text-[#F0F6FC]">{getSampleText(activeSampleDetail, 'name')}</strong>.
                          </div>
                        ) : (
                          activeStudyThread.map((msg) => (
                            <div
                              key={msg.id}
                              className={`p-3 rounded-xl text-xs sm:text-sm leading-relaxed font-sans ${
                                msg.sender === 'user'
                                  ? 'bg-[#1E3A8A] dark:bg-[#2563EB] text-[#FFFFFF] ml-6'
                                  : 'bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#E2E8F0] mr-6 shadow-xs'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[11px] opacity-80 mb-1">
                                <strong>{msg.senderName}</strong>
                                <span className="font-mono">{msg.timestamp}</span>
                              </div>
                              <p>{msg.content}</p>
                            </div>
                          ))
                        )}
                        {isStudyReplying && (
                          <div className="flex items-center gap-2 text-xs text-[#475569] dark:text-[#94A3B8] p-2">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#1E3A8A]" strokeWidth={1.75} />
                            <span>{t("Copiloto IA a responder…", "AI Copilot is replying…")}</span>
                          </div>
                        )}
                      </div>

                      <form onSubmit={handleSendStudyChat} className="flex gap-2">
                        <input
                          type="text"
                          aria-label={t(`Conversar sobre a pesquisa ${getSampleText(activeSampleDetail, 'name')}`, `Discuss the study ${getSampleText(activeSampleDetail, 'name')}`)}
                          value={studyChatInput}
                          onChange={(e) => setStudyChatInput(e.target.value)}
                          placeholder={t("Escreva uma pergunta ou comentário sobre esta pesquisa...", "Write a question or comment about this study...")}
                          className="flex-1 min-w-0 bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#F0F6FC] placeholder:text-[#64748B] text-sm px-3.5 py-2 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
                        />
                        <button
                          type="submit"
                          disabled={!studyChatInput.trim() || isStudyReplying}
                          className="min-h-[40px] py-2 px-4 bg-[#1E3A8A] dark:bg-[#2563EB] disabled:opacity-50 text-[#FFFFFF] text-sm font-medium rounded-xl flex items-center gap-1.5 cursor-pointer shrink-0"
                        >
                          <Send className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                          <span>{t("Enviar", "Send")}</span>
                        </button>
                      </form>
                    </div>

                    {/* Peer Contributions */}
                    <div className="space-y-3">
                      <h4 className="font-poppins text-sm font-semibold text-[#0F172A] dark:text-[#F0F6FC]">
                        {t("Opiniões da Comunidade", "Community Feedback")} ({activeSampleDetail.peerComments?.length || 0})
                      </h4>

                      {contributionNotice && (
                        <div aria-live="polite" className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-xs text-[#15803D] dark:text-[#4ADE80] flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                          <span>{contributionNotice}</span>
                        </div>
                      )}

                      <div className="space-y-2">
                        {activeSampleDetail.peerComments?.map((c) => (
                          <div key={c.id} className="p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117] space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div>
                                <strong className="text-[#0F172A] dark:text-[#F0F6FC]">{c.author}</strong>
                                <span className="text-[#475569] dark:text-[#94A3B8]"> · {c.institution} · {formatDay(c.timestamp)}</span>
                              </div>
                              {c.statusChange === 'approved' && (
                                <span className="text-[#15803D] dark:text-[#4ADE80] bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-lg font-medium">
                                  {t("Endosso", "Endorsement")}
                                </span>
                              )}
                            </div>
                            <p className="text-xs sm:text-sm text-[#475569] dark:text-[#94A3B8] leading-relaxed">{c.content}</p>
                          </div>
                        ))}
                      </div>

                      {!currentUser ? (
                        <p className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117] text-xs text-[#475569] dark:text-[#94A3B8]">
                          {t("Entre na sua conta para comentar ou endossar este estudo.", "Sign in to comment on or endorse this study.")}
                        </p>
                      ) : (
                      <form onSubmit={handlePostContribution} className="space-y-2.5 pt-1">
                        <textarea
                          rows={2}
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder={t("Comente ou dê sua opinião sobre esta pesquisa...", "Leave a comment or share your view on this study...")}
                          className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-sm p-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
                        />
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          {endorseBlock === null ? (
                            <label className="flex items-center gap-2 text-xs text-[#475569] dark:text-[#94A3B8] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={endorsed}
                                onChange={(e) => setEndorsed(e.target.checked)}
                                className="w-4 h-4 accent-[#1E3A8A] rounded cursor-pointer"
                              />
                              <span>
                                Endossar este estudo ({endorsementCount}/{REQUIRED_ENDORSEMENTS} para validação)
                              </span>
                            </label>
                          ) : (
                            <span className="text-xs text-[#64748B] dark:text-[#8B949E]">
                              {endorseBlock === 'own_study'
                                ? t("Não pode endossar o seu próprio estudo.", "You cannot endorse your own study.")
                                : t("Já endossou este estudo.", "You have already endorsed this study.")}
                            </span>
                          )}
                          <button
                            type="submit"
                            disabled={!newComment.trim()}
                            className="min-h-[38px] py-1.5 px-4 bg-[#1E3A8A] dark:bg-[#2563EB] disabled:opacity-50 text-[#FFFFFF] text-xs font-medium rounded-xl cursor-pointer"
                          >
                            {t("Publicar Comentário", "Post Comment")}
                          </button>
                        </div>
                      </form>
                      )}
                    </div>
                  </div>
                )}

                {/* -------- TAB 2: DADOS -------- */}
                {studyTab === 'data' && (
                  <div className="space-y-4">
                    {/* 4 Quantitative Bento Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3.5 bg-[#F8FAFC] dark:bg-[#0D1117] rounded-xl">
                        <span className="text-[#475569] dark:text-[#94A3B8] block">{t("Atividade de água (aw)", "Water activity (aw)")}</span>
                        <strong className="font-mono text-base text-[#0F172A] dark:text-[#F0F6FC] tabular-nums">
                          {Math.round(activeSampleDetail.waterActivity * 100)}%
                        </strong>
                      </div>
                      <div className="p-3.5 bg-[#F8FAFC] dark:bg-[#0D1117] rounded-xl">
                        <span className="text-[#475569] dark:text-[#94A3B8] block">{t("Acidez (pH)", "Acidity (pH)")}</span>
                        <strong className="font-mono text-base text-[#0F172A] dark:text-[#F0F6FC] tabular-nums">
                          {activeSampleDetail.pH}
                        </strong>
                      </div>
                      <div className="p-3.5 bg-[#F8FAFC] dark:bg-[#0D1117] rounded-xl">
                        <span className="text-[#475569] dark:text-[#94A3B8] block">{t("Profundidade", "Depth")}</span>
                        <strong className="font-mono text-base text-[#0F172A] dark:text-[#F0F6FC] tabular-nums">
                          {activeSampleDetail.depthCm} cm
                        </strong>
                      </div>
                      <div className="p-3.5 bg-[#F8FAFC] dark:bg-[#0D1117] rounded-xl">
                        <span className="text-[#475569] dark:text-[#94A3B8] block">{t("Semelhança", "Similarity")}</span>
                        <strong className="font-mono text-base text-[#1E3A8A] dark:text-[#60A5FA] tabular-nums">
                          {activeSampleDetail.fidelityScores.total}%
                        </strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                      {/* Minerals Pie Chart + Legend */}
                      <div className="p-4 bg-[#F8FAFC] dark:bg-[#0D1117] rounded-xl space-y-3 flex flex-col justify-between">
                        <h4 className="font-poppins text-xs font-semibold text-[#0F172A] dark:text-[#F0F6FC]">
                          {t("Tipos de Minerais no Solo (%)", "Soil Mineral Composition (%)")}
                        </h4>
                        {(() => {
                          const palette = ['#1E3A8A', '#0F766E', '#D97706', '#2563EB', '#059669', '#64748B'];
                          const entries = Object.entries(activeSampleDetail.minerals).sort((a, b) => b[1] - a[1]);
                          const total = entries.reduce((acc, [, v]) => acc + v, 0) || 1;
                          const r = 42;
                          const circ = 2 * Math.PI * r;
                          let offsetFrac = 0;
                          return (
                            <div className="flex flex-col sm:flex-row items-center gap-4">
                              <svg viewBox="0 0 116 116" className="w-28 h-28 shrink-0" role="img" aria-label={t("Gráfico de pizza dos minerais", "Mineral composition pie chart")}>
                                <g transform="rotate(-90 58 58)">
                                  {entries.map(([min, val], idx) => {
                                    const frac = val / total;
                                    const dash = Math.max(0, frac * circ);
                                    const dashOffset = -offsetFrac * circ;
                                    offsetFrac += frac;
                                    return (
                                      <circle
                                        key={min}
                                        cx="58"
                                        cy="58"
                                        r={r}
                                        fill="transparent"
                                        stroke={palette[idx % palette.length]}
                                        strokeWidth="16"
                                        strokeDasharray={`${dash.toFixed(1)} ${(circ - dash).toFixed(1)}`}
                                        strokeDashoffset={dashOffset.toFixed(1)}
                                      />
                                    );
                                  })}
                                </g>
                                <text x="58" y="61" textAnchor="middle" className="fill-[#0F172A] dark:fill-[#F0F6FC] text-xs font-bold font-mono">
                                  {entries.length} tipos
                                </text>
                              </svg>
                              <div className="w-full space-y-1.5 text-xs">
                                {entries.map(([min, val], idx) => (
                                  <div key={min} className="flex items-center justify-between gap-2 bg-[#FFFFFF] dark:bg-[#161B22] px-2.5 py-1.5 rounded-lg">
                                    <span className="inline-flex items-center gap-2 min-w-0">
                                      <span
                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ backgroundColor: palette[idx % palette.length] }}
                                      />
                                      <span className="truncate text-[#0F172A] dark:text-[#F0F6FC] font-medium">{min}</span>
                                    </span>
                                    <span className="font-mono font-semibold text-[#1E3A8A] dark:text-[#60A5FA] tabular-nums shrink-0">
                                      {val}%
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Composition & Similarity Scores */}
                      <div className="p-4 bg-[#F8FAFC] dark:bg-[#0D1117] rounded-xl space-y-3 flex flex-col justify-between">
                        <h4 className="font-poppins text-xs font-semibold text-[#0F172A] dark:text-[#F0F6FC]">
                          {t("O que forma a rocha & Notas por Tema", "Rock Composition and Scores by Criterion")}
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {Object.entries(activeSampleDetail.xrfComposition).map(([ox, val]) => (
                            <div key={ox} className="p-2 rounded-lg bg-[#FFFFFF] dark:bg-[#161B22] flex justify-between">
                              <span className="text-[#475569] dark:text-[#94A3B8]">{ox}</span>
                              <span className="font-mono font-semibold text-[#0F172A] dark:text-[#F0F6FC] tabular-nums">{val}%</span>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-5 gap-1.5 text-center text-xs bg-[#FFFFFF] dark:bg-[#161B22] p-2 rounded-lg">
                          <div>
                            <div className="text-[#475569] dark:text-[#94A3B8]">{t("Rochas", "Rocks")}</div>
                            <div className="font-mono font-bold text-[#1E3A8A] dark:text-[#60A5FA]">{activeSampleDetail.fidelityScores.mineralogy}%</div>
                          </div>
                          <div>
                            <div className="text-[#475569] dark:text-[#94A3B8]">{t("Terreno", "Terrain")}</div>
                            <div className="font-mono font-bold text-[#0F766E] dark:text-[#2DD4BF]">{activeSampleDetail.fidelityScores.geomorphology}%</div>
                          </div>
                          <div>
                            <div className="text-[#475569] dark:text-[#94A3B8]">{t("Solo", "Soil")}</div>
                            <div className="font-mono font-bold text-[#D97706]">{activeSampleDetail.fidelityScores.geochemistry}%</div>
                          </div>
                          <div>
                            <div className="text-[#475569] dark:text-[#94A3B8]">{t("Sol", "Sunlight")}</div>
                            <div className="font-mono font-bold text-[#0F172A] dark:text-[#F0F6FC]">{activeSampleDetail.fidelityScores.radiation}%</div>
                          </div>
                          <div>
                            <div className="text-[#475569] dark:text-[#94A3B8]">{t("Clima", "Climate")}</div>
                            <div className="font-mono font-bold text-[#0F172A] dark:text-[#F0F6FC]">{activeSampleDetail.fidelityScores.thermal}%</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* -------- TAB 3: RESUMO -------- */}
                {studyTab === 'report' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F8FAFC] dark:bg-[#0D1117] p-4 rounded-xl">
                      <div>
                        <div className="text-xs text-[#475569] dark:text-[#94A3B8]">
                          Registrado em {activeSampleDetail.collectedAt}
                        </div>
                        <div className="font-poppins text-sm font-bold text-[#0F172A] dark:text-[#F0F6FC]">
                          {t("Resumo da Pesquisa", "Research Summary")}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleGenerateStudyReport}
                          disabled={isGeneratingStudyReport}
                          className="min-h-[36px] py-1.5 px-3 bg-[#1E3A8A] dark:bg-[#2563EB] disabled:opacity-50 text-[#FFFFFF] text-xs font-medium rounded-xl flex items-center gap-1.5 cursor-pointer"
                        >
                          {isGeneratingStudyReport ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          <span>{currentStudyReportText ? t("Atualizar Resumo", "Update Summary") : t("Criar Resumo com IA", "Create AI Summary")}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleDownloadStudyMarkdown}
                          className="min-h-[36px] py-1.5 px-3 bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#F0F6FC] text-xs font-medium rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{t("Baixar", "Download")}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="min-h-[36px] py-1.5 px-3 bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#F0F6FC] text-xs font-medium rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                      </div>
                    </div>

                    {studyReportError && (
                      <div role="alert" className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl text-xs text-[#B91C1C] dark:text-[#FCA5A5]">
                        {studyReportError}
                      </div>
                    )}

                    {currentStudyReportText ? (
                      <div className="p-5 bg-[#F8FAFC] dark:bg-[#0D1117] rounded-xl text-xs sm:text-sm font-sans text-[#0F172A] dark:text-[#E2E8F0] whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                        {currentStudyReportText}
                      </div>
                    ) : (
                      <div className="p-5 bg-[#F8FAFC] dark:bg-[#0D1117] rounded-xl space-y-4 text-sm">
                        <div>
                          <span className="text-xs font-semibold text-[#475569] dark:text-[#94A3B8] block mb-1">
                            {t("O que foi observado no local", "Site Observations")}
                          </span>
                          <p className="text-[#0F172A] dark:text-[#E2E8F0] leading-relaxed">{getSampleText(activeSampleDetail, 'fieldNotes')}</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="p-3 rounded-xl bg-[#FFFFFF] dark:bg-[#161B22]">
                            <span className="text-[#475569] dark:text-[#94A3B8] block">{t("Lugar & Comparação", "Site and Comparison")}</span>
                            <strong className="text-[#0F172A] dark:text-[#F0F6FC] mt-0.5 block">
                              {activeSampleDetail.customLocation || getSiteText(studyReportSite, 'name')} → {getSiteText(studyReportSite, 'planetaryCounterpart')}
                            </strong>
                          </div>
                          <div className="p-3 rounded-xl bg-[#FFFFFF] dark:bg-[#161B22]">
                            <span className="text-[#475569] dark:text-[#94A3B8] block">{t("Origem dos Dados", "Data Source")}</span>
                            <strong className="text-[#0F172A] dark:text-[#F0F6FC] mt-0.5 block">
                              {getSampleText(activeSampleDetail, 'officialSource')}
                            </strong>
                          </div>
                        </div>

                        <div>
                          <span className="text-xs font-semibold text-[#15803D] dark:text-[#4ADE80] block mb-1">
                            {t("Conclusão Principal", "Main Conclusion")}
                          </span>
                          <p className="text-[#0F172A] dark:text-[#E2E8F0] leading-relaxed">{studyConclusionText}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleCopyCitation(activeSampleDetail)}
                        className="py-1.5 px-3 bg-[#F1F5F9] dark:bg-[#21262D] text-[#0F172A] dark:text-[#F0F6FC] text-xs font-medium rounded-xl flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedCitation === activeSampleDetail.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#15803D]" />
                            <span>{t("Copiado", "Copied")}</span>
                          </>
                        ) : (
                          <>
                            <Share2 className="w-3.5 h-3.5" />
                            <span>{t("Copiar Referência", "Copy Citation")}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* -------- TAB 4: ETAPAS & CONCLUSÃO -------- */}
                {studyTab === 'timeline' && (
                  <div className="space-y-5">
                    <div className="space-y-3">
                      {studyTimeline.map((step) => (
                        <div
                          key={step.id}
                          className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117] flex items-start gap-3.5"
                        >
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                              step.status === 'completed'
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-[#15803D] dark:text-[#4ADE80]'
                                : 'bg-amber-100 dark:bg-amber-950/60 text-[#B45309] dark:text-[#FBBF24]'
                            }`}
                          >
                            {step.status === 'completed' ? (
                              <Check className="w-3.5 h-3.5" strokeWidth={2.2} />
                            ) : (
                              <Clock className="w-3.5 h-3.5" strokeWidth={2} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <strong className="text-sm text-[#0F172A] dark:text-[#F0F6FC]">{step.stage}</strong>
                              <span className="text-[#475569] dark:text-[#94A3B8]">{step.timestamp}</span>
                            </div>
                            <div className="text-xs text-[#1E3A8A] dark:text-[#60A5FA] font-medium mt-0.5">
                              {step.author}
                            </div>
                            <p className="text-xs sm:text-sm text-[#475569] dark:text-[#94A3B8] mt-1 leading-relaxed">
                              {step.detail}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Highlighted Conclusions Bowl */}
                    <div className="p-5 rounded-xl bg-emerald-50/75 dark:bg-emerald-950/30 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-bold text-[#15803D] dark:text-[#4ADE80]">
                        <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                        <span>{activeSampleDetail.conclusion ? 'Conclusão do autor' : 'Conclusão'}</span>
                      </div>
                      <p className="text-xs sm:text-sm text-[#0F172A] dark:text-[#E2E8F0] leading-relaxed">
                        {studyConclusionText}
                      </p>
                    </div>
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        {/* RIGHT DIRECTORY (4 cols): People & Collaborators */}
        <aside
          aria-labelledby="collaborators-directory-heading"
          className="lg:col-span-4 bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-5 shadow-xs space-y-4 order-2 lg:sticky lg:top-20 transition-colors duration-150"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 id="collaborators-directory-heading" className="font-poppins text-sm font-semibold text-[#0F172A] dark:text-[#F0F6FC]">
                Pessoas ({filteredCollaborators.length})
              </h2>
              <button
                type="button"
                onClick={() => handleSelectCollaborator('ALL')}
                className={`text-xs font-medium cursor-pointer ${
                  selectedCollaboratorId === 'ALL'
                    ? 'text-[#1E3A8A] dark:text-[#60A5FA] font-semibold underline'
                    : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F0F6FC]'
                }`}
              >
                {t("Ver todas", "View all")}
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-[#64748B] dark:text-[#8B949E] absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.75} aria-hidden="true" />
              <input
                type="text"
                aria-label={t("Buscar pessoa por nome, país ou tema", "Search for a person by name, country or topic")}
                placeholder={t("Buscar pessoa ou tema...", "Search for a person or topic...")}
                value={collaboratorSearch}
                onChange={(e) => setCollaboratorSearch(e.target.value)}
                className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] placeholder:text-[#94A3B8] dark:placeholder:text-[#6E7681] text-xs pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] dark:focus-visible:ring-[#60A5FA]"
              />
            </div>
          </div>

          <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
            {filteredCollaborators.map((col) => {
              const isSelected = selectedCollaboratorId === col.id;
              const colConnected = connectedIds.includes(col.id);
              const studyCount = samples.filter(
                (s) => s.collaboratorId === col.id || s.collectorName === col.name
              ).length;

              return (
                <button
                  key={col.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleSelectCollaborator(col.id)}
                  className={`w-full text-left p-3.5 rounded-xl flex items-start gap-3 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1E3A8A] dark:focus-visible:ring-[#60A5FA] ${
                    isSelected
                      ? 'bg-[#F1F5F9] dark:bg-[#21262D]'
                      : 'bg-[#F8FAFC] dark:bg-[#0D1117] hover:bg-[#F1F5F9] dark:hover:bg-[#1C2128]'
                  }`}
                >
                  <AvatarWithFallback src={col.avatarUrl} name={col.name} sizeClass="w-11 h-11" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-[#1E3A8A] dark:text-[#60A5FA] truncate">
                        {col.country}
                      </span>
                      <span className="text-[#475569] dark:text-[#94A3B8] shrink-0 tabular-nums">
                        {colConnected ? 'Conectado · ' : ''}
                        {studyCount} {studyCount === 1 ? 'pesquisa' : 'pesquisas'} ·{' '}
                        <span title={t("Pontos de contribuição (ver perfil)", "Contribution points (view profile)")}>
                          {(pointsByCollaborator.get(col.id) || 0).toLocaleString(getLocale())} pts
                        </span>
                      </span>
                    </div>

                    <div className="text-sm font-semibold text-[#0F172A] dark:text-[#F0F6FC] mt-0.5 truncate">
                      {col.name}
                    </div>

                    <div className="text-xs text-[#475569] dark:text-[#94A3B8] mt-0.5 line-clamp-2">
                      {col.role} · {col.specialty}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-[#64748B] dark:text-[#8B949E] mt-1">
                      <Globe2 className="w-3 h-3 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                      <span className="truncate">{col.institution}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
};
