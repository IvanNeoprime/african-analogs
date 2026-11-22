import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AnalogueSite,
  CollaboratorProfile,
  DirectResearchMessage,
  GeologicalSample,
  LatestAiAnalysisSnapshot,
  LocalUserAccount,
  PlanetaryTarget,
  ResearchNetworkGroup,
} from '../types';
import {
  CELESTIAL_BODIES,
  DWARF_PLANET_BODIES,
  PLANET_BODIES,
  SATELLITE_BODIES,
  bodyName,
  bodyFullName,
  bodyOptionLabel,
} from '../data/celestialBodies';
import {
  generateDynamicAvatarSvg,
  normalizeCodename,
  RegisterAccountInput,
} from '../services/localAccountStore';
import { computeAnalogueFidelity, generateSpectralReflectanceCurve } from '../services/spectralEngine';
import { computeSampleFingerprint } from '../services/fingerprint';
import { collectContributions } from '../services/contributions';
import { ContributionGraph } from './ContributionGraph';
import {
  UserPlus,
  LogIn,
  LogOut,
  Camera,
  Check,
  AlertCircle,
  Sparkles,
  BookOpen,
  Download,
  KeyRound,
  Eye,
  EyeOff,
  Users,
  Trash2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Plus,
  Settings,
  Pencil,
  SlidersHorizontal,
} from 'lucide-react';

interface AccountEcosystemViewProps {
  currentUser: CollaboratorProfile | null;
  accounts: LocalUserAccount[];
  sites: AnalogueSite[];
  samples: GeologicalSample[];
  activeSample: GeologicalSample;
  connectedIds: string[];
  activeNetworkCount: number;
  studyThreads: Record<string, DirectResearchMessage[]>;
  networkGroups: ResearchNetworkGroup[];
  latestAiAnalysis?: LatestAiAnalysisSnapshot | null;
  publishTriggerCount?: number;
  onRegister: (input: RegisterAccountInput) => Promise<void>;
  onLogin: (identifier: string, password: string) => Promise<void>;
  onUpdateProfile: (profileId: string, patch: Partial<CollaboratorProfile>) => void;
  onUpdatePassword: (accountId: string, currentPassword: string, newPassword: string) => Promise<void>;
  onLogout: () => void;
  onPublishStudy: (sample: GeologicalSample) => void;
  onDeleteOwnSample: (sampleId: string) => void;
  onOpenSampleInResearch: (sample: GeologicalSample) => void;
  onOpenMyProfileInNetwork: (profileId: string) => void;
}

const QUICK_PLANET_OPTIONS = CELESTIAL_BODIES.filter((b) => b.featuredInQuickList);
const EXTENDED_CELESTIAL_OPTIONS = CELESTIAL_BODIES.filter((b) => !b.featuredInQuickList);

async function resizeAvatarImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Erro ao ler imagem de perfil.'));
    reader.readAsDataURL(file);
  });

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      const minSide = Math.min(img.width, img.height);
      const sx = (img.width - minSide) / 2;
      const sy = (img.height - minSide) / 2;
      ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
      resolve(canvas.toDataURL('image/jpeg', 0.86));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export const AccountEcosystemView: React.FC<AccountEcosystemViewProps> = ({
  currentUser,
  accounts,
  sites,
  samples,
  activeSample,
  connectedIds,
  activeNetworkCount,
  studyThreads,
  networkGroups,
  latestAiAnalysis,
  publishTriggerCount = 0,
  onRegister,
  onLogin,
  onUpdateProfile,
  onUpdatePassword,
  onLogout,
  onPublishStudy,
  onDeleteOwnSample,
  onOpenSampleInResearch,
  onOpenMyProfileInNetwork,
}) => {
  // Simple 2-step onboarding + login switcher
  const [authTab, setAuthTab] = useState<'register' | 'login'>('register');
  const [regStep, setRegStep] = useState<1 | 2>(1);
  const [regName, setRegName] = useState('');
  const [regCodename, setRegCodename] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regInstitution, setRegInstitution] = useState('');
  const [regCountry, setRegCountry] = useState('Angola');
  const [regRole, setRegRole] = useState('Explorador / Estudante');
  const [regBio, setRegBio] = useState('');
  const [regPlanets, setRegPlanets] = useState<PlanetaryTarget[]>(['Mars', 'Moon']);
  const [regOpenToContrib, setRegOpenToContrib] = useState(true);
  const [regAvatarUrl, setRegAvatarUrl] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Organized Profile Sub-Tabs
  const [profileSection, setProfileSection] = useState<'studies' | 'publish' | 'settings'>('studies');

  // Simple Dynamic Profile Editor States
  const [editName, setEditName] = useState('');
  const [editCodename, setEditCodename] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editInstitution, setEditInstitution] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editOrcid, setEditOrcid] = useState('');
  const [editSpecialty, setEditSpecialty] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPlanets, setEditPlanets] = useState<PlanetaryTarget[]>(['Mars']);
  const [editOpenToContrib, setEditOpenToContrib] = useState(true);
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [profileNotice, setProfileNotice] = useState<string | null>(null);

  // Publish & Edit Study + Dashboard Data Form States
  const [editingSampleId, setEditingSampleId] = useState<string | null>(null);
  const [studyTitle, setStudyTitle] = useState('');
  const [studyCustomLocation, setStudyCustomLocation] = useState('');
  const [studyPlanet, setStudyPlanet] = useState<PlanetaryTarget>('Mars');
  const [studyRockClass, setStudyRockClass] = useState('Solo / Rocha Natural');
  const [studyAw, setStudyAw] = useState('0.28');
  const [studyPh, setStudyPh] = useState('6.8');
  const [studyDepth, setStudyDepth] = useState('10');
  const [studyPorosity, setStudyPorosity] = useState('18');
  const [studyMineralsText, setStudyMineralsText] = useState('Basalto: 45, Óxido de Ferro: 35, Areia: 20');
  const [studyXrf, setStudyXrf] = useState<{ [oxide: string]: number }>({
    SiO2: 49.8,
    Fe2O3: 17.2,
    Al2O3: 13.4,
    MgO: 7.9,
    CaO: 6.2,
  });
  const [studyScores, setStudyScores] = useState<GeologicalSample['fidelityScores']>({
    mineralogy: 86,
    geomorphology: 84,
    geochemistry: 82,
    radiation: 80,
    thermal: 79,
    total: 83,
  });
  const [showChartEditor, setShowChartEditor] = useState(false);
  const [studyNotes, setStudyNotes] = useState('');
  const [studyNotice, setStudyNotice] = useState<string | null>(null);

  // Password Change States
  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdMessage, setPwdMessage] = useState<string | null>(null);
  const [pwdError, setPwdError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      setEditName(currentUser.name);
      setEditCodename(currentUser.codename);
      setEditRole(currentUser.role);
      setEditInstitution(currentUser.institution);
      setEditCountry(currentUser.country);
      setEditOrcid(currentUser.orcid || '');
      setEditSpecialty(currentUser.specialty);
      setEditBio(currentUser.bio);
      setEditPlanets(currentUser.focusPlanets || ['Mars']);
      setEditOpenToContrib(currentUser.openToContributions);
      setEditAvatarUrl(currentUser.avatarUrl);
    }
  }, [currentUser]);

  const parseMineralsInput = (text: string): Record<string, number> => {
    const parts = text
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (parts.length === 0) {
      return { Basalto: 60, 'Óxido de Ferro': 40 };
    }

    const explicitEntries: [string, number][] = [];
    const plainNames: string[] = [];

    for (const part of parts) {
      const match = part.match(/^(.+?)\s*[:=]\s*(\d+(?:\.\d+)?)\s*%?$/);
      if (match) {
        explicitEntries.push([match[1].trim(), Math.max(1, Math.round(parseFloat(match[2])))]);
      } else {
        plainNames.push(part);
      }
    }

    if (explicitEntries.length > 0 && plainNames.length === 0) {
      return Object.fromEntries(explicitEntries);
    }

    const allNames = [...explicitEntries.map(([k]) => k), ...plainNames];
    const base = Math.floor(100 / allNames.length);
    const out: Record<string, number> = {};
    allNames.forEach((name, idx) => {
      out[name] = idx === 0 ? 100 - base * (allNames.length - 1) : base;
    });
    return out;
  };

  const copilotAssistText = useMemo(() => {
    if (!latestAiAnalysis) return '';
    return [
      latestAiAnalysis.reportText,
      latestAiAnalysis.diagnosticResult,
      latestAiAnalysis.chatReply,
      latestAiAnalysis.visionClosestAnalogue
        ? `Sugestão do Copiloto Visual: parece com ${latestAiAnalysis.visionClosestAnalogue}${
            latestAiAnalysis.visionMinerals?.length
              ? ` (minerais sugeridos: ${latestAiAnalysis.visionMinerals.join(', ')})`
              : ''
          }.`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  }, [latestAiAnalysis]);

  const loadManualActiveSampleToForm = () => {
    const siteMatch = sites.find((s) => s.id === activeSample.siteId);
    setStudyTitle(activeSample.name || '');
    setStudyCustomLocation(activeSample.customLocation || siteMatch?.name || '');
    setStudyPlanet(activeSample.targetPlanet);
    setStudyRockClass(activeSample.rockClassification || 'Solo / Rocha Natural');
    setStudyAw(String(activeSample.waterActivity));
    setStudyPh(String(activeSample.pH));
    setStudyDepth(String(activeSample.depthCm));
    setStudyPorosity(String(activeSample.porosityPercent));
    setStudyMineralsText(
      Object.entries(activeSample.minerals || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
    );
    setStudyXrf({
      ...(activeSample.xrfComposition || {
        SiO2: 49.8,
        Fe2O3: 17.2,
        Al2O3: 13.4,
        MgO: 7.9,
        CaO: 6.2,
      }),
    });
    setStudyScores({ ...activeSample.fidelityScores });
    setStudyNotes(activeSample.conclusion || activeSample.fieldNotes || '');
    setShowChartEditor(true);
  };

  const lastHandledPublishRef = useRef(0);

  useEffect(() => {
    if (publishTriggerCount > lastHandledPublishRef.current && currentUser) {
      lastHandledPublishRef.current = publishTriggerCount;
      setEditingSampleId(null);
      setProfileSection('publish');
      loadManualActiveSampleToForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publishTriggerCount, currentUser]);

  const myPublishedSamples = useMemo(() => {
    if (!currentUser) return [];
    return samples.filter(
      (s) =>
        s.collaboratorId === currentUser.id ||
        s.collectorName.toLowerCase() === currentUser.name.toLowerCase()
    );
  }, [samples, currentUser]);

  const activeAccountRecord = useMemo(() => {
    if (!currentUser) return null;
    return accounts.find((acc) => acc.profileId === currentUser.id) || null;
  }, [accounts, currentUser]);

  const togglePlanetSelection = (
    setter: React.Dispatch<React.SetStateAction<PlanetaryTarget[]>>,
    planet: PlanetaryTarget
  ) => {
    setter((prev) =>
      prev.includes(planet) ? (prev.length > 1 ? prev.filter((p) => p !== planet) : prev) : [...prev, planet]
    );
  };

  const handleAdvanceStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setAuthError('Preencha seu nome, e-mail e senha para continuar.');
      return;
    }
    if (regPassword.length < 8) {
      setAuthError('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setAuthError('As duas senhas digitadas não estão iguais.');
      return;
    }
    if (!regCodename.trim()) {
      setRegCodename(normalizeCodename(regName));
    }
    setRegStep(2);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmittingAuth(true);
    try {
      await onRegister({
        name: regName,
        codename: regCodename || regName,
        email: regEmail,
        password: regPassword,
        institution: regInstitution || 'Comunidade Aberta',
        country: regCountry || 'África',
        role: regRole || 'Explorador',
        specialty: regRole || 'Observação Planetária',
        bio: regBio || `Membro da comunidade explorando lugares parecidos com ${regPlanets.join(' e ')}.`,
        focusPlanets: regPlanets,
        openToContributions: regOpenToContrib,
        avatarUrl: regAvatarUrl,
      });
      setRegStep(1);
    } catch (err: any) {
      setAuthError(err?.message || 'Não foi possível criar a conta.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsSubmittingAuth(true);
    try {
      await onLogin(loginIdentifier, loginPassword);
      setLoginPassword('');
    } catch (err: any) {
      setLoginError(err?.message || 'E-mail/apelido ou senha inválidos.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleSaveDynamicProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    onUpdateProfile(currentUser.id, {
      name: editName.trim() || currentUser.name,
      codename: normalizeCodename(editCodename || editName),
      role: editRole.trim() || currentUser.role,
      institution: editInstitution.trim() || 'Comunidade Aberta',
      country: editCountry.trim() || currentUser.country,
      orcid: editOrcid.trim() || undefined,
      specialty: editSpecialty.trim() || editRole.trim() || currentUser.specialty,
      bio: editBio.trim() || currentUser.bio,
      focusPlanets: editPlanets,
      openToContributions: editOpenToContrib,
      avatarUrl: editAvatarUrl || currentUser.avatarUrl,
    });
    setProfileNotice('Perfil atualizado com sucesso.');
    setTimeout(() => setProfileNotice(null), 4000);
  };

  const handleRecalculateScoresFromSoil = () => {
    const mineralsMap = parseMineralsInput(studyMineralsText);
    const aw = Math.min(1, Math.max(0, parseFloat(studyAw) || 0.28));
    const pH = Math.min(14, Math.max(0, parseFloat(studyPh) || 6.8));
    const depthCm = Math.max(0, parseFloat(studyDepth) || 10);
    const porosityPercent = Math.min(90, Math.max(0, parseFloat(studyPorosity) || 18));

    setStudyScores(
      computeAnalogueFidelity(
        {
          targetPlanet: studyPlanet,
          waterActivity: aw,
          pH,
          depthCm,
          porosityPercent,
          minerals: mineralsMap,
        },
        studyPlanet,
        sites.find(
          (s) =>
            studyCustomLocation.trim() &&
            (s.name.toLowerCase() === studyCustomLocation.trim().toLowerCase() ||
              studyCustomLocation.toLowerCase().includes(s.name.toLowerCase()))
        ) || null
      )
    );
  };

  const handleStartEditStudy = (smp: GeologicalSample) => {
    const fallbackSite = sites.find((s) => s.id === smp.siteId);
    setEditingSampleId(smp.id);
    setStudyTitle(smp.name);
    setStudyCustomLocation(smp.customLocation || fallbackSite?.name || '');
    setStudyPlanet(smp.targetPlanet);
    setStudyRockClass(smp.rockClassification || 'Solo / Rocha Natural');
    setStudyAw(String(smp.waterActivity));
    setStudyPh(String(smp.pH));
    setStudyDepth(String(smp.depthCm));
    setStudyPorosity(String(smp.porosityPercent));
    setStudyMineralsText(
      Object.entries(smp.minerals || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
    );
    setStudyXrf({ ...(smp.xrfComposition || { SiO2: 49.8, Fe2O3: 17.2, Al2O3: 13.4, MgO: 7.9, CaO: 6.2 }) });
    setStudyScores({ ...smp.fidelityScores });
    setStudyNotes(smp.conclusion || smp.fieldNotes || '');
    setShowChartEditor(true);
    setProfileSection('publish');
  };

  const handleStartNewPublish = () => {
    setEditingSampleId(null);
    setStudyTitle('');
    setStudyCustomLocation('');
    setStudyNotes('');
    setShowChartEditor(false);
    setProfileSection('publish');
  };

  const handlePublishNewStudy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !studyTitle.trim() || !studyCustomLocation.trim()) return;

    const typedLocation = studyCustomLocation.trim();
    const matchedSite =
      sites.find(
        (s) =>
          s.name.toLowerCase() === typedLocation.toLowerCase() ||
          typedLocation.toLowerCase().includes(s.name.toLowerCase()) ||
          typedLocation.toLowerCase().includes(s.country.toLowerCase())
      ) || sites[0];

    const mineralsMap = parseMineralsInput(studyMineralsText);
    const aw = Math.min(1, Math.max(0, parseFloat(studyAw) || 0.28));
    const pH = Math.min(14, Math.max(0, parseFloat(studyPh) || 6.8));
    const depthCm = Math.max(0, parseFloat(studyDepth) || 10);
    const porosityPercent = Math.min(90, Math.max(0, parseFloat(studyPorosity) || 18));

    const existingSample = editingSampleId
      ? samples.find((s) => s.id === editingSampleId)
      : undefined;

    const finalScores: GeologicalSample['fidelityScores'] = {
      mineralogy: Math.min(100, Math.max(0, Math.round(studyScores.mineralogy))),
      geomorphology: Math.min(100, Math.max(0, Math.round(studyScores.geomorphology))),
      geochemistry: Math.min(100, Math.max(0, Math.round(studyScores.geochemistry))),
      radiation: Math.min(100, Math.max(0, Math.round(studyScores.radiation))),
      thermal: Math.min(100, Math.max(0, Math.round(studyScores.thermal))),
      total: Math.min(100, Math.max(0, Math.round(studyScores.total))),
    };

    const todayStr = new Date().toISOString().split('T')[0];

    const publishedStudy: GeologicalSample = {
      ...(existingSample || {}),
      id: existingSample ? existingSample.id : `smp-usr-${Date.now().toString(36)}`,
      publishedAt: existingSample?.publishedAt || new Date().toISOString(),
      name: studyTitle.trim(),
      siteId: matchedSite.id,
      customLocation: typedLocation,
      collaboratorId: currentUser.id,
      collectorName: currentUser.name,
      institution: currentUser.institution,
      collectedAt: existingSample?.collectedAt || todayStr,
      coordinates: existingSample?.coordinates || matchedSite.coordinates,
      depthCm,
      rockClassification: studyRockClass.trim() || 'Solo / Rocha Natural',
      targetPlanet: studyPlanet,
      waterActivity: aw,
      pH,
      porosityPercent,
      minerals: mineralsMap,
      xrfComposition: studyXrf,
      fidelityScores: finalScores,
      spectralCurve: generateSpectralReflectanceCurve(mineralsMap),
      fieldNotes:
        studyNotes.trim() ||
        `Pesquisa publicada por ${currentUser.name} no local "${typedLocation}", comparada com ${studyPlanet}.`,
      conclusion:
        studyNotes.trim() ||
        `O local "${typedLocation}" alcançou ${finalScores.total.toFixed(0)}% de semelhança com ${studyPlanet}.`,
      reportSummary:
        existingSample?.reportSummary ||
        `Publicação manual de ${currentUser.name} sobre ${typedLocation}.`,
      timeline: existingSample
        ? [
            ...(existingSample.timeline || []),
            {
              id: `tl-${Date.now()}`,
              stage: 'Artigo e dados manuais atualizados',
              timestamp: todayStr,
              author: currentUser.name,
              detail: `Local "${typedLocation}" e gráficos atualizados (${finalScores.total}% de semelhança).`,
              status: 'completed',
            },
          ]
        : [
            {
              id: `tl-${Date.now()}`,
              stage: 'Pesquisa publicada manualmente',
              timestamp: todayStr,
              author: currentUser.name,
              detail: `Local "${typedLocation}" compartilhado com ${finalScores.total.toFixed(0)}% de semelhança.`,
              status: 'completed',
            },
          ],
      version: existingSample ? '1.1' : '1.0',
      hash: '',
      status: existingSample?.status || 'under_review',
      officialSource: existingSample?.officialSource || 'Registro Manual do Pesquisador',
      peerComments: existingSample?.peerComments || [],
    };

    // Fingerprint of the published content: editing the study yields a new value.
    publishedStudy.hash = computeSampleFingerprint(publishedStudy);
    onPublishStudy(publishedStudy);
    setEditingSampleId(null);
    setStudyTitle('');
    setStudyCustomLocation('');
    setStudyNotes('');
    setShowChartEditor(false);
    setStudyNotice(
      existingSample
        ? `"${publishedStudy.name}" (${typedLocation}) e seus gráficos foram atualizados!`
        : `"${publishedStudy.name}" (${typedLocation}) foi publicado no seu perfil!`
    );
    setProfileSection('studies');
    setTimeout(() => setStudyNotice(null), 4500);
  };

  const handleAdoptActiveSample = () => {
    if (!currentUser) return;
    const cloned: GeologicalSample = {
      ...activeSample,
      id: `smp-prof-${Date.now().toString(36)}`,
      collaboratorId: currentUser.id,
      collectorName: currentUser.name,
      institution: currentUser.institution,
      collectedAt: new Date().toISOString().split('T')[0],
    };
    onPublishStudy(cloned);
    setStudyNotice(`"${cloned.name}" foi adicionado às suas pesquisas.`);
    setTimeout(() => setStudyNotice(null), 4000);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdMessage(null);
    if (!activeAccountRecord) return;
    try {
      await onUpdatePassword(activeAccountRecord.id, curPwd, newPwd);
      setCurPwd('');
      setNewPwd('');
      setPwdMessage('Sua senha foi atualizada.');
      setTimeout(() => setPwdMessage(null), 4000);
    } catch (err: any) {
      setPwdError(err?.message || 'Não foi possível alterar a senha.');
    }
  };

  const handleExportAccountBackup = () => {
    if (!currentUser) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: currentUser,
      publishedStudies: myPublishedSamples,
      connectionsCount: connectedIds.length,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meu-perfil-${currentUser.codename.replace('@', '')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // =========================================================================
  // VIEW A: SIMPLE & WELCOMING SIGN-UP / LOGIN
  // =========================================================================
  if (!currentUser) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* LEFT COLUMN (5 cols): Plain Explanation + Quick Account Picker */}
        <section className="lg:col-span-5 bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <span className="text-xs font-medium text-[#1E3A8A] dark:text-[#60A5FA]">
              Comunidade African Analogs
            </span>
            <h1 className="font-poppins text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A] dark:text-[#F0F6FC] leading-tight">
              Crie seu perfil simples em poucos segundos.
            </h1>
            <p className="text-sm text-[#475569] dark:text-[#94A3B8] leading-relaxed">
              Não precisa ser cientista para participar. Com uma conta você salva suas descobertas, envia fotos e conversa com outras pessoas interessadas em planetas.
            </p>

            <div className="space-y-2.5 pt-2">
              {[
                { title: 'Seu espaço pessoal', desc: 'Escolha seu nome, foto e quais planetas você mais gosta.' },
                { title: 'Publique e compartilhe', desc: 'Guarde suas pesquisas e receba dicas nos comentários.' },
                { title: 'Privado por defeito', desc: 'O seu e-mail nunca é público. Só os estudos que publicar ficam visíveis.' },
              ].map((item) => (
                <div key={item.title} className="p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117] flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#0F766E] dark:text-[#2DD4BF] shrink-0 mt-0.5" strokeWidth={1.75} />
                  <div>
                    <div className="text-xs font-semibold text-[#0F172A] dark:text-[#F0F6FC]">{item.title}</div>
                    <div className="text-xs text-[#475569] dark:text-[#94A3B8]">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {accounts.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="text-xs font-semibold text-[#0F172A] dark:text-[#F0F6FC]">
                Contas salvas neste aparelho ({accounts.length})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                {accounts.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => {
                      setAuthTab('login');
                      setLoginIdentifier(acc.email);
                    }}
                    className="w-full text-left px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117] hover:bg-[#F1F5F9] dark:hover:bg-[#21262D] transition-colors flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#0F172A] dark:text-[#F0F6FC] truncate">
                        {acc.codename}
                      </div>
                      <div className="text-xs text-[#475569] dark:text-[#94A3B8] truncate">{acc.email}</div>
                    </div>
                    <span className="text-xs font-medium text-[#1E3A8A] dark:text-[#60A5FA] shrink-0">Entrar</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* RIGHT COLUMN (7 cols): CLEAN 2-STEP SIGN-UP / LOGIN */}
        <section className="lg:col-span-7 bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col justify-between space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-[#F1F5F9] dark:bg-[#0D1117] p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setAuthTab('register');
                  setAuthError(null);
                }}
                className={`py-2 px-4 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                  authTab === 'register'
                    ? 'bg-[#1E3A8A] dark:bg-[#2563EB] text-[#FFFFFF]'
                    : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F0F6FC]'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                <span>Criar Conta</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab('login');
                  setLoginError(null);
                }}
                className={`py-2 px-4 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                  authTab === 'login'
                    ? 'bg-[#1E3A8A] dark:bg-[#2563EB] text-[#FFFFFF]'
                    : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F0F6FC]'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                <span>Entrar</span>
              </button>
            </div>

            {authTab === 'register' && (
              <div className="flex items-center gap-2 text-xs text-[#475569] dark:text-[#94A3B8]">
                <span className={regStep === 1 ? 'text-[#1E3A8A] dark:text-[#60A5FA] font-semibold' : ''}>1. Conta</span>
                <span aria-hidden="true">→</span>
                <span className={regStep === 2 ? 'text-[#1E3A8A] dark:text-[#60A5FA] font-semibold' : ''}>2. Perfil</span>
              </div>
            )}
          </div>

          {authTab === 'register' ? (
            regStep === 1 ? (
              <form onSubmit={handleAdvanceStep1} className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <div>
                    <h2 className="font-poppins text-lg font-bold text-[#0F172A] dark:text-[#F0F6FC]">
                      Passo 1 — Seus dados básicos
                    </h2>
                    <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
                      Informe seu nome, e-mail e crie uma senha de acesso.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="reg-name" className="block text-xs font-medium text-[#475569] dark:text-[#94A3B8] mb-1">
                      Seu Nome *
                    </label>
                    <input
                      id="reg-name"
                      required
                      type="text"
                      value={regName}
                      onChange={(e) => {
                        setRegName(e.target.value);
                        setRegCodename(normalizeCodename(e.target.value));
                      }}
                      placeholder="Ex: Maria Silva"
                      className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-email" className="block text-xs font-medium text-[#475569] dark:text-[#94A3B8] mb-1">
                      Seu E-mail *
                    </label>
                    <input
                      id="reg-email"
                      required
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="voce@email.com"
                      className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label htmlFor="reg-pwd" className="block text-xs font-medium text-[#475569] dark:text-[#94A3B8] mb-1">
                        Senha (mín. 8 caracteres) *
                      </label>
                      <div className="relative">
                        <input
                          id="reg-pwd"
                          required
                          minLength={8}
                          type={showRegPassword ? 'text' : 'password'}
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-sm pl-3.5 pr-9 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword((p) => !p)}
                          aria-label={showRegPassword ? 'Ocultar senha' : 'Mostrar senha'}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#475569] dark:text-[#94A3B8] cursor-pointer"
                        >
                          {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="reg-pwd-confirm" className="block text-xs font-medium text-[#475569] dark:text-[#94A3B8] mb-1">
                        Repetir Senha *
                      </label>
                      <input
                        id="reg-pwd-confirm"
                        required
                        minLength={8}
                        type={showRegPassword ? 'text' : 'password'}
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                      />
                    </div>
                  </div>

                  {authError && (
                    <div role="alert" className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl text-xs text-[#B91C1C] dark:text-[#FCA5A5] flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.75} />
                      <span>{authError}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-2">
                  <button
                    type="submit"
                    className="w-full min-h-[44px] py-2.5 px-5 bg-[#1E3A8A] dark:bg-[#2563EB] hover:bg-[#1E40AF] dark:hover:bg-[#1D4ED8] text-[#FFFFFF] text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Continuar</span>
                    <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                  </button>
                  <p className="text-center text-xs text-[#475569] dark:text-[#94A3B8]">
                    Já tem conta?{' '}
                    <button
                      type="button"
                      onClick={() => setAuthTab('login')}
                      className="text-[#1E3A8A] dark:text-[#60A5FA] font-semibold hover:underline cursor-pointer"
                    >
                      Entrar
                    </button>
                  </p>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-poppins text-lg font-bold text-[#0F172A] dark:text-[#F0F6FC]">
                        Passo 2 — Seu perfil
                      </h2>
                      <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
                        Escolha como você aparece para outras pessoas (pode mudar depois).
                      </p>
                    </div>
                    <img
                      src={regAvatarUrl || generateDynamicAvatarSvg(regName || 'Perfil')}
                      alt="Prévia da foto de perfil"
                      className="w-12 h-12 rounded-full object-cover bg-[#F1F5F9] dark:bg-[#0D1117] shrink-0"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="reg-codename" className="block text-xs font-medium text-[#475569] dark:text-[#94A3B8] mb-1">
                        Apelido (@nome) *
                      </label>
                      <input
                        id="reg-codename"
                        required
                        type="text"
                        value={regCodename}
                        onChange={(e) => setRegCodename(e.target.value)}
                        placeholder="@mariasilva"
                        className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                      />
                    </div>
                    <div>
                      <label htmlFor="reg-role" className="block text-xs font-medium text-[#475569] dark:text-[#94A3B8] mb-1">
                        O que você faz (opcional)
                      </label>
                      <input
                        id="reg-role"
                        type="text"
                        value={regRole}
                        onChange={(e) => setRegRole(e.target.value)}
                        placeholder="Ex: Estudante, Professor, Curioso"
                        className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="reg-country" className="block text-xs font-medium text-[#475569] dark:text-[#94A3B8] mb-1">
                        País ou Cidade
                      </label>
                      <input
                        id="reg-country"
                        type="text"
                        value={regCountry}
                        onChange={(e) => setRegCountry(e.target.value)}
                        placeholder="Ex: Angola, Brasil..."
                        className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                      />
                    </div>
                    <div>
                      <label htmlFor="reg-inst" className="block text-xs font-medium text-[#475569] dark:text-[#94A3B8] mb-1">
                        Escola, Empresa ou Grupo (opcional)
                      </label>
                      <input
                        id="reg-inst"
                        type="text"
                        value={regInstitution}
                        onChange={(e) => setRegInstitution(e.target.value)}
                        placeholder="Opcional"
                        className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="block text-xs font-medium text-[#475569] dark:text-[#94A3B8]">
                      Planetas e satélites naturais de interesse
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_PLANET_OPTIONS.map((p) => {
                        const active = regPlanets.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => togglePlanetSelection(setRegPlanets, p.id)}
                            className={`py-1.5 px-3 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                              active
                                ? 'bg-[#1E3A8A] dark:bg-[#2563EB] text-[#FFFFFF]'
                                : 'bg-[#F1F5F9] dark:bg-[#0D1117] text-[#475569] dark:text-[#94A3B8]'
                            }`}
                          >
                            {bodyName(p)}
                          </button>
                        );
                      })}
                    </div>
                    <details className="rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117] p-2.5">
                      <summary className="text-[11px] font-medium text-[#1E3A8A] dark:text-[#60A5FA] cursor-pointer select-none">
                        Ver todos os planetas e satélites naturais ({EXTENDED_CELESTIAL_OPTIONS.length}+)
                      </summary>
                      <div className="flex flex-wrap gap-1.5 pt-2">
                        {EXTENDED_CELESTIAL_OPTIONS.map((p) => {
                          const active = regPlanets.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => togglePlanetSelection(setRegPlanets, p.id)}
                              className={`py-1 px-2.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                                active
                                  ? 'bg-[#1E3A8A] dark:bg-[#2563EB] text-[#FFFFFF]'
                                  : 'bg-[#FFFFFF] dark:bg-[#161B22] text-[#475569] dark:text-[#94A3B8]'
                              }`}
                            >
                              {bodyFullName(p)}
                            </button>
                          );
                        })}
                      </div>
                    </details>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-[#0F172A] dark:text-[#F0F6FC] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={regOpenToContrib}
                        onChange={(e) => setRegOpenToContrib(e.target.checked)}
                        className="rounded accent-[#1E3A8A]"
                      />
                      <span>Aceitar mensagens e conversas</span>
                    </label>

                    <label className="py-1.5 px-3 rounded-xl bg-[#F1F5F9] dark:bg-[#0D1117] hover:bg-[#E2E8F0] dark:hover:bg-[#21262D] text-xs font-medium text-[#0F172A] dark:text-[#F0F6FC] inline-flex items-center gap-1.5 cursor-pointer">
                      <Camera className="w-3.5 h-3.5 text-[#1E3A8A] dark:text-[#60A5FA]" strokeWidth={1.75} aria-hidden="true" />
                      <span>{regAvatarUrl ? 'Foto escolhida' : 'Escolher foto'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) setRegAvatarUrl(await resizeAvatarImage(file));
                        }}
                      />
                    </label>
                  </div>

                  {authError && (
                    <div role="alert" className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl text-xs text-[#B91C1C] dark:text-[#FCA5A5] flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.75} />
                      <span>{authError}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setRegStep(1)}
                    className="min-h-[42px] py-2 px-4 bg-[#F1F5F9] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span>Voltar</span>
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAuth}
                    className="sm:col-span-2 min-h-[42px] py-2 px-4 bg-[#1E3A8A] dark:bg-[#2563EB] hover:bg-[#1E40AF] dark:hover:bg-[#1D4ED8] text-[#FFFFFF] text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                    <span>{isSubmittingAuth ? 'Criando...' : 'Concluir e Entrar'}</span>
                  </button>
                </div>
              </form>
            )
          ) : (
            <form onSubmit={handleLoginSubmit} className="space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <h2 className="font-poppins text-lg font-bold text-[#0F172A] dark:text-[#F0F6FC]">
                    Entrar na sua conta
                  </h2>
                  <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
                    Use o e-mail ou @apelido que você cadastrou.
                  </p>
                </div>

                <div>
                  <label htmlFor="login-id" className="block text-xs font-medium text-[#475569] dark:text-[#94A3B8] mb-1">
                    E-mail ou Apelido
                  </label>
                  <input
                    id="login-id"
                    required
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="voce@email.com ou @apelido"
                    className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                  />
                </div>

                <div>
                  <label htmlFor="login-pwd" className="block text-xs font-medium text-[#475569] dark:text-[#94A3B8] mb-1">
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      id="login-pwd"
                      required
                      type={showLoginPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-sm pl-3.5 pr-9 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((p) => !p)}
                      aria-label={showLoginPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#475569] dark:text-[#94A3B8] cursor-pointer"
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {loginError && (
                  <div role="alert" className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl text-xs text-[#B91C1C] dark:text-[#FCA5A5] flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.75} />
                    <span>{loginError}</span>
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingAuth}
                  className="w-full min-h-[44px] py-2.5 px-4 bg-[#1E3A8A] dark:bg-[#2563EB] hover:bg-[#1E40AF] dark:hover:bg-[#1D4ED8] text-[#FFFFFF] text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                  <span>{isSubmittingAuth ? 'Entrando...' : 'Entrar'}</span>
                </button>
                <p className="text-center text-xs text-[#475569] dark:text-[#94A3B8]">
                  Ainda não tem conta?{' '}
                  <button
                    type="button"
                    onClick={() => setAuthTab('register')}
                    className="text-[#1E3A8A] dark:text-[#60A5FA] font-semibold hover:underline cursor-pointer"
                  >
                    Criar conta grátis
                  </button>
                </p>
              </div>
            </form>
          )}
        </section>
      </div>
    );
  }

  // =========================================================================
  // VIEW B: CLEAN, SIMPLE & WELL-ORGANIZED LOGGED-IN PROFILE
  // =========================================================================
  return (
    <div className="space-y-5">
      {/* Simple Profile Header Card */}
      <section className="bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4">
            <div className="relative shrink-0">
              <img
                src={editAvatarUrl || currentUser.avatarUrl}
                alt={`Foto de ${currentUser.name}`}
                className="w-20 h-20 rounded-full object-cover bg-[#F1F5F9] dark:bg-[#0D1117]"
              />
              <label
                title="Trocar foto de perfil"
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#1E3A8A] dark:bg-[#2563EB] text-[#FFFFFF] flex items-center justify-center shadow-sm cursor-pointer hover:bg-[#1E40AF]"
              >
                <Camera className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const url = await resizeAvatarImage(file);
                      setEditAvatarUrl(url);
                      onUpdateProfile(currentUser.id, { avatarUrl: url });
                    }
                  }}
                />
              </label>
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#475569] dark:text-[#94A3B8]">
                <span className="font-medium text-[#1E3A8A] dark:text-[#60A5FA]">{currentUser.codename}</span>
                <span aria-hidden="true">·</span>
                <span>{currentUser.country}</span>
                <span aria-hidden="true">·</span>
                <span>{currentUser.openToContributions ? 'Aberto para conversas' : 'Modo privado'}</span>
              </div>
              <h1 className="font-poppins text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A] dark:text-[#F0F6FC]">
                {currentUser.name}
              </h1>
              <p className="text-sm text-[#475569] dark:text-[#94A3B8]">
                {currentUser.role}
                {currentUser.institution && currentUser.institution !== 'Comunidade Aberta'
                  ? ` · ${currentUser.institution}`
                  : ''}
              </p>
              {currentUser.bio && (
                <p className="text-xs text-[#475569] dark:text-[#94A3B8] max-w-2xl pt-0.5">
                  {currentUser.bio}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenMyProfileInNetwork(currentUser.id)}
              className="min-h-[40px] py-2 px-4 rounded-xl bg-[#F1F5F9] dark:bg-[#0D1117] hover:bg-[#E2E8F0] dark:hover:bg-[#21262D] text-xs font-medium text-[#0F172A] dark:text-[#F0F6FC] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Users className="w-4 h-4 text-[#1E3A8A] dark:text-[#60A5FA]" strokeWidth={1.75} aria-hidden="true" />
              <span>Ver na Comunidade</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="min-h-[40px] py-2 px-4 rounded-xl bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 text-xs font-medium text-[#B91C1C] dark:text-[#FCA5A5] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
              <span>Sair</span>
            </button>
          </div>
        </div>

        {/* 3 Clean Summary Counters + Organized Navigation Tabs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center pt-1">
          <div className="lg:col-span-6 grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117]">
              <div className="text-xs text-[#475569] dark:text-[#94A3B8]">Minhas Pesquisas</div>
              <div className="text-xl font-bold font-mono text-[#0F172A] dark:text-[#F0F6FC] tabular-nums">
                {myPublishedSamples.length}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117]">
              <div className="text-xs text-[#475569] dark:text-[#94A3B8]">Conexões</div>
              <div className="text-xl font-bold font-mono text-[#1E3A8A] dark:text-[#60A5FA] tabular-nums">
                {connectedIds.length}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117]">
              <div className="text-xs text-[#475569] dark:text-[#94A3B8]">Grupos</div>
              <div className="text-xl font-bold font-mono text-[#0F766E] dark:text-[#2DD4BF] tabular-nums">
                {activeNetworkCount}
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 flex lg:justify-end">
            <div
              role="tablist"
              aria-label="Seções do meu perfil"
              className="w-full lg:w-auto grid grid-cols-3 gap-1 p-1 bg-[#F1F5F9] dark:bg-[#0D1117] rounded-xl"
            >
              <button
                type="button"
                role="tab"
                aria-selected={profileSection === 'studies'}
                onClick={() => setProfileSection('studies')}
                className={`min-h-[38px] py-1.5 px-3 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  profileSection === 'studies'
                    ? 'bg-[#FFFFFF] dark:bg-[#21262D] text-[#1E3A8A] dark:text-[#60A5FA] font-semibold shadow-xs'
                    : 'text-[#475569] dark:text-[#94A3B8]'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                <span className="truncate">Minhas Pesquisas</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={profileSection === 'publish'}
                onClick={() => setProfileSection('publish')}
                className={`min-h-[38px] py-1.5 px-3 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  profileSection === 'publish'
                    ? 'bg-[#FFFFFF] dark:bg-[#21262D] text-[#1E3A8A] dark:text-[#60A5FA] font-semibold shadow-xs'
                    : 'text-[#475569] dark:text-[#94A3B8]'
                }`}
              >
                <Plus className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                <span className="truncate">Publicar</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={profileSection === 'settings'}
                onClick={() => setProfileSection('settings')}
                className={`min-h-[38px] py-1.5 px-3 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  profileSection === 'settings'
                    ? 'bg-[#FFFFFF] dark:bg-[#21262D] text-[#1E3A8A] dark:text-[#60A5FA] font-semibold shadow-xs'
                    : 'text-[#475569] dark:text-[#94A3B8]'
                }`}
              >
                <Settings className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                <span className="truncate">Editar &amp; Conta</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {studyNotice && (
        <div role="status" className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs text-[#15803D] dark:text-[#4ADE80] flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" strokeWidth={1.75} />
          <span>{studyNotice}</span>
        </div>
      )}

      {/* GitHub-style contribution calendar for the signed-in researcher */}
      {currentUser && profileSection === 'studies' && (
        <section className="bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-6 shadow-xs">
          <ContributionGraph
            events={collectContributions(currentUser, { samples, studyThreads, networkGroups })}
            ownerLabel={currentUser.name}
            isSelf
            heading="As suas contribuições"
          />
        </section>
      )}

      {/* SECTION 1: MY RESEARCHES LIST */}
      {profileSection === 'studies' && (
        <section className="bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-poppins text-base font-bold text-[#0F172A] dark:text-[#F0F6FC]">
                Suas Pesquisas Salvas ({myPublishedSamples.length})
              </h2>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
                Tudo o que você publicou fica visível para receber comentários e comparações.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAdoptActiveSample}
                className="py-2 px-3.5 rounded-xl bg-[#F1F5F9] dark:bg-[#0D1117] hover:bg-[#E2E8F0] dark:hover:bg-[#21262D] text-xs font-medium text-[#0F766E] dark:text-[#2DD4BF] cursor-pointer"
              >
                + Salvar Pesquisa Atual
              </button>
              <button
                type="button"
                onClick={handleStartNewPublish}
                className="py-2 px-4 rounded-xl bg-[#1E3A8A] dark:bg-[#2563EB] text-xs font-medium text-[#FFFFFF] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>Nova Publicação</span>
              </button>
            </div>
          </div>

          {myPublishedSamples.length === 0 ? (
            <div className="p-8 rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117] text-center space-y-3">
              <p className="text-sm text-[#475569] dark:text-[#94A3B8]">
                Você ainda não publicou nenhuma pesquisa no seu perfil.
              </p>
              <button
                type="button"
                onClick={handleStartNewPublish}
                className="py-2 px-4 rounded-xl bg-[#1E3A8A] dark:bg-[#2563EB] text-xs font-medium text-[#FFFFFF] cursor-pointer"
              >
                Criar primeira publicação
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {myPublishedSamples.map((smp) => {
                const placeLabel =
                  smp.customLocation ||
                  sites.find((s) => s.id === smp.siteId)?.name ||
                  'Local personalizado';
                return (
                  <div
                    key={smp.id}
                    className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#0F172A] dark:text-[#F0F6FC] truncate">
                        {smp.name}
                      </div>
                      <div className="text-xs text-[#475569] dark:text-[#94A3B8] mt-0.5 truncate">
                        {placeLabel} · {smp.targetPlanet} ·{' '}
                        <span className="font-mono tabular-nums">{smp.fidelityScores.total.toFixed(0)}%</span> ·{' '}
                        {smp.collectedAt}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEditStudy(smp)}
                        className="py-1.5 px-2.5 rounded-lg bg-[#FFFFFF] dark:bg-[#161B22] text-xs font-medium text-[#0F766E] dark:text-[#2DD4BF] hover:bg-[#F1F5F9] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" strokeWidth={1.75} />
                        <span>Editar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenSampleInResearch(smp)}
                        className="py-1.5 px-2.5 rounded-lg bg-[#FFFFFF] dark:bg-[#161B22] text-xs font-medium text-[#1E3A8A] dark:text-[#60A5FA] hover:bg-[#F1F5F9] cursor-pointer"
                      >
                        Abrir
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteOwnSample(smp.id)}
                        aria-label={`Remover ${smp.name}`}
                        className="p-2 rounded-lg text-[#B91C1C] dark:text-[#FCA5A5] hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* SECTION 2: PUBLISH OR EDIT ARTICLE + MANUAL PLACE + AI & DASHBOARD DATA EDITOR */}
      {profileSection === 'publish' && (
        <section className="bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-poppins text-base font-bold text-[#0F172A] dark:text-[#F0F6FC]">
                {editingSampleId ? 'Editar Artigo & Dados do Painel' : 'Publicar Novo Artigo ou Descoberta'}
              </h2>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
                Todos os dados da pesquisa e o lugar são inseridos manualmente por você. O Copiloto IA serve apenas para ajudar na interpretação.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={loadManualActiveSampleToForm}
                className="py-2 px-3.5 rounded-xl bg-[#F1F5F9] dark:bg-[#0D1117] hover:bg-[#E2E8F0] dark:hover:bg-[#21262D] text-xs font-medium text-[#0F766E] dark:text-[#2DD4BF] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>Carregar Meus Dados Atuais</span>
              </button>

              {editingSampleId && (
                <button
                  type="button"
                  onClick={handleStartNewPublish}
                  className="py-2 px-3 rounded-xl bg-[#F1F5F9] dark:bg-[#0D1117] text-xs font-medium text-[#475569] dark:text-[#94A3B8] cursor-pointer"
                >
                  Cancelar Edição
                </button>
              )}
            </div>
          </div>

          {copilotAssistText && (
            <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117] space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-[#1E3A8A] dark:text-[#60A5FA] inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>Copiloto IA — Análise de Apoio (não preenche dados sozinho)</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setStudyNotes((prev) =>
                      prev.trim() ? `${prev.trim()}\n\n${copilotAssistText}` : copilotAssistText
                    )
                  }
                  className="py-1 px-2.5 rounded-lg bg-[#FFFFFF] dark:bg-[#161B22] text-xs font-medium text-[#1E3A8A] dark:text-[#60A5FA] shadow-xs cursor-pointer"
                >
                  Inserir comentário na conclusão
                </button>
              </div>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8] max-h-24 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {copilotAssistText}
              </p>
            </div>
          )}

          <form onSubmit={handlePublishNewStudy} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label htmlFor="pub-title" className="block text-xs font-medium text-[#475569] dark:text-[#94A3B8] mb-1">
                  Título do Artigo *
                </label>
                <input
                  id="pub-title"
                  required
                  type="text"
                  value={studyTitle}
                  onChange={(e) => setStudyTitle(e.target.value)}
                  placeholder="Ex: Dunas Secas do Namibe"
                  className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                />
              </div>

              <div>
                <label htmlFor="pub-location" className="block text-xs font-medium text-[#475569] dark:text-[#94A3B8] mb-1">
                  Lugar (escrito manualmente) *
                </label>
                <input
                  id="pub-location"
                  required
                  type="text"
                  list="pub-location-suggestions"
                  value={studyCustomLocation}
                  onChange={(e) => setStudyCustomLocation(e.target.value)}
                  placeholder="Ex: Deserto do Namibe, Angola"
                  className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                />
                <datalist id="pub-location-suggestions">
                  {sites.map((s) => (
                    <option key={s.id} value={`${s.name}, ${s.country}`} />
                  ))}
                </datalist>
              </div>

              <div>
                <label htmlFor="pub-planet" className="block text-xs font-medium text-[#475569] dark:text-[#94A3B8] mb-1">
                  Parece com qual planeta ou satélite natural?
                </label>
                <select
                  id="pub-planet"
                  value={studyPlanet}
                  onChange={(e) => setStudyPlanet(e.target.value as PlanetaryTarget)}
                  className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                >
                  <optgroup label="Planetas do Sistema Solar">
                    {PLANET_BODIES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {bodyOptionLabel(p)}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Planetas Anões">
                    {DWARF_PLANET_BODIES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {bodyOptionLabel(p)}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Satélites Naturais (Luas)">
                    {SATELLITE_BODIES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {bodyOptionLabel(p)}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="pub-notes" className="block text-xs font-medium text-[#475569] dark:text-[#94A3B8] mb-1">
                Texto, Observações &amp; Conclusão do Artigo
              </label>
              <textarea
                id="pub-notes"
                rows={4}
                value={studyNotes}
                onChange={(e) => setStudyNotes(e.target.value)}
                placeholder="Escreva ou edite o texto da sua análise com a IA, o que encontrou no local e sua conclusão..."
                className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-sm p-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
              />
            </div>

            {/* Editable Dashboard & Chart Metrics Panel */}
            <div className="bg-[#F8FAFC] dark:bg-[#0D1117] rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowChartEditor((prev) => !prev)}
                  className="text-xs font-semibold text-[#1E3A8A] dark:text-[#60A5FA] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>
                    {showChartEditor
                      ? 'Ocultar editor de dados e gráficos do painel'
                      : 'Editar dados do painel e gráficos (notas, minerais, umidade e pH)'}
                  </span>
                </button>

                <span className="text-xs font-mono font-semibold text-[#0F766E] dark:text-[#2DD4BF] tabular-nums">
                  Semelhança nos gráficos: {studyScores.total}%
                </span>
              </div>

              {showChartEditor && (
                <div className="space-y-4 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-[#475569] dark:text-[#94A3B8]">
                      Notas por critério (0–100%)
                    </span>
                    <button
                      type="button"
                      onClick={handleRecalculateScoresFromSoil}
                      className="py-1 px-2.5 rounded-lg bg-[#FFFFFF] dark:bg-[#161B22] text-xs font-medium text-[#1E3A8A] dark:text-[#60A5FA] cursor-pointer shadow-xs"
                    >
                      Recalcular pelo solo
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    {(
                      [
                        { key: 'total', label: 'Geral (%)' },
                        { key: 'mineralogy', label: 'Rochas (%)' },
                        { key: 'geomorphology', label: 'Terreno (%)' },
                        { key: 'geochemistry', label: 'Solo (%)' },
                        { key: 'radiation', label: 'Sol/UV (%)' },
                        { key: 'thermal', label: 'Clima (%)' },
                      ] as const
                    ).map((item) => (
                      <div key={item.key}>
                        <label
                          htmlFor={`score-${item.key}`}
                          className="block text-[11px] font-medium text-[#475569] dark:text-[#94A3B8] mb-1"
                        >
                          {item.label}
                        </label>
                        <input
                          id={`score-${item.key}`}
                          type="number"
                          min={0}
                          max={100}
                          value={studyScores[item.key]}
                          onChange={(e) => {
                            const val = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                            setStudyScores((prev) => ({ ...prev, [item.key]: val }));
                          }}
                          className="w-full bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#F0F6FC] font-mono text-xs px-2.5 py-2 rounded-lg tabular-nums"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="pub-minerals" className="block text-xs text-[#475569] dark:text-[#94A3B8] mb-1">
                        Minerais (ex.: Basalto: 45, Ferro: 35, Areia: 20)
                      </label>
                      <input
                        id="pub-minerals"
                        type="text"
                        value={studyMineralsText}
                        onChange={(e) => setStudyMineralsText(e.target.value)}
                        className="w-full bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#F0F6FC] text-xs px-3 py-2 rounded-lg"
                      />
                    </div>
                    <div>
                      <label htmlFor="pub-rock" className="block text-xs text-[#475569] dark:text-[#94A3B8] mb-1">
                        Tipo de rocha ou solo
                      </label>
                      <input
                        id="pub-rock"
                        type="text"
                        value={studyRockClass}
                        onChange={(e) => setStudyRockClass(e.target.value)}
                        className="w-full bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#F0F6FC] text-xs px-3 py-2 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label htmlFor="pub-aw" className="block text-xs text-[#475569] dark:text-[#94A3B8] mb-1">
                        Atividade de água (aw, 0–1)
                      </label>
                      <input
                        id="pub-aw"
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={studyAw}
                        onChange={(e) => setStudyAw(e.target.value)}
                        className="w-full bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#F0F6FC] font-mono text-xs px-2.5 py-2 rounded-lg tabular-nums"
                      />
                    </div>
                    <div>
                      <label htmlFor="pub-ph" className="block text-xs text-[#475569] dark:text-[#94A3B8] mb-1">
                        pH do solo
                      </label>
                      <input
                        id="pub-ph"
                        type="number"
                        step="0.1"
                        min="0"
                        max="14"
                        value={studyPh}
                        onChange={(e) => setStudyPh(e.target.value)}
                        className="w-full bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#F0F6FC] font-mono text-xs px-2.5 py-2 rounded-lg tabular-nums"
                      />
                    </div>
                    <div>
                      <label htmlFor="pub-depth" className="block text-xs text-[#475569] dark:text-[#94A3B8] mb-1">
                        Profundidade (cm)
                      </label>
                      <input
                        id="pub-depth"
                        type="number"
                        step="1"
                        min="0"
                        value={studyDepth}
                        onChange={(e) => setStudyDepth(e.target.value)}
                        className="w-full bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#F0F6FC] font-mono text-xs px-2.5 py-2 rounded-lg tabular-nums"
                      />
                    </div>
                    <div>
                      <label htmlFor="pub-por" className="block text-xs text-[#475569] dark:text-[#94A3B8] mb-1">
                        Porosidade (%)
                      </label>
                      <input
                        id="pub-por"
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={studyPorosity}
                        onChange={(e) => setStudyPorosity(e.target.value)}
                        className="w-full bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#F0F6FC] font-mono text-xs px-2.5 py-2 rounded-lg tabular-nums"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="block text-[11px] font-medium text-[#475569] dark:text-[#94A3B8] mb-1.5">
                      Composição química da rocha (%)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {Object.entries(studyXrf).map(([oxide, val]) => (
                        <div key={oxide}>
                          <label htmlFor={`xrf-${oxide}`} className="block text-[11px] text-[#475569] dark:text-[#94A3B8] mb-0.5">
                            {oxide}
                          </label>
                          <input
                            id={`xrf-${oxide}`}
                            type="number"
                            step="0.1"
                            min={0}
                            max={100}
                            value={val}
                            onChange={(e) =>
                              setStudyXrf((prev) => ({
                                ...prev,
                                [oxide]: parseFloat(e.target.value) || 0,
                              }))
                            }
                            className="w-full bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#F0F6FC] font-mono text-xs px-2.5 py-1.5 rounded-lg tabular-nums"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full sm:w-auto min-h-[42px] py-2.5 px-6 bg-[#1E3A8A] dark:bg-[#2563EB] hover:bg-[#1E40AF] text-[#FFFFFF] text-sm font-medium rounded-xl transition-colors cursor-pointer"
            >
              {editingSampleId ? 'Salvar Alterações do Artigo & Painel' : 'Publicar Artigo no Meu Perfil'}
            </button>
          </form>
        </section>
      )}

      {/* SECTION 3: SIMPLE EDIT PROFILE & PASSWORD */}
      {profileSection === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <section className="lg:col-span-7 bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-poppins text-base font-bold text-[#0F172A] dark:text-[#F0F6FC]">
                  Editar Meus Dados
                </h2>
                <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
                  Deixe seu perfil simples e com a sua cara.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const svgUrl = generateDynamicAvatarSvg(editName || currentUser.name);
                  setEditAvatarUrl(svgUrl);
                  onUpdateProfile(currentUser.id, { avatarUrl: svgUrl });
                }}
                className="py-1.5 px-3 rounded-xl bg-[#F1F5F9] dark:bg-[#0D1117] text-xs font-medium text-[#1E3A8A] dark:text-[#60A5FA] inline-flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                <span>Gerar Iniciais</span>
              </button>
            </div>

            <form onSubmit={handleSaveDynamicProfile} className="space-y-3.5 flex-1 flex flex-col justify-between">
              <div className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="edit-name" className="block text-xs font-medium text-[#475569] dark:text-[#94A3B8] mb-1">
                      Nome
                    </label>
                    <input
                      id="edit-name"
                      required
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-sm px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-codename" className="block text-xs font-medium text-[#475569] dark:text-[#94A3B8] mb-1">
                      Apelido (@nome)
                    </label>
                    <input
                      id="edit-codename"
                      required
                      type="text"
                      value={editCodename}
                      onChange={(e) => setEditCodename(e.target.value)}
                      className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-sm px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="edit-role" className="block text-xs font-medium text-[#475569] dark:text-[#94A3B8] mb-1">
                      O que você faz
                    </label>
                    <input
                      id="edit-role"
                      type="text"
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-sm px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-country" className="block text-xs font-medium text-[#475569] dark:text-[#94A3B8] mb-1">
                      Cidade / País
                    </label>
                    <input
                      id="edit-country"
                      type="text"
                      value={editCountry}
                      onChange={(e) => setEditCountry(e.target.value)}
                      className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-sm px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="edit-inst" className="block text-xs font-medium text-[#475569] dark:text-[#94A3B8] mb-1">
                    Escola, Universidade ou Equipe (opcional)
                  </label>
                  <input
                    id="edit-inst"
                    type="text"
                    value={editInstitution}
                    onChange={(e) => setEditInstitution(e.target.value)}
                    className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-sm px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                  />
                </div>

                <div className="space-y-2">
                  <span className="block text-xs font-medium text-[#475569] dark:text-[#94A3B8]">
                    Planetas e Satélites de Interesse
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_PLANET_OPTIONS.map((p) => {
                      const active = editPlanets.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePlanetSelection(setEditPlanets, p.id)}
                          className={`py-1.5 px-3 rounded-lg text-xs font-medium cursor-pointer ${
                            active
                              ? 'bg-[#1E3A8A] dark:bg-[#2563EB] text-[#FFFFFF]'
                              : 'bg-[#F1F5F9] dark:bg-[#0D1117] text-[#475569] dark:text-[#94A3B8]'
                          }`}
                        >
                          {bodyName(p)}
                        </button>
                      );
                    })}
                  </div>
                  <details className="rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117] p-2.5">
                    <summary className="text-[11px] font-medium text-[#1E3A8A] dark:text-[#60A5FA] cursor-pointer select-none">
                      Mais planetas e satélites naturais ({EXTENDED_CELESTIAL_OPTIONS.length}+)
                    </summary>
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {EXTENDED_CELESTIAL_OPTIONS.map((p) => {
                        const active = editPlanets.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => togglePlanetSelection(setEditPlanets, p.id)}
                            className={`py-1 px-2.5 rounded-lg text-[11px] font-medium cursor-pointer ${
                              active
                                ? 'bg-[#1E3A8A] dark:bg-[#2563EB] text-[#FFFFFF]'
                                : 'bg-[#FFFFFF] dark:bg-[#161B22] text-[#475569] dark:text-[#94A3B8]'
                            }`}
                          >
                            {bodyFullName(p)}
                          </button>
                        );
                      })}
                    </div>
                  </details>
                </div>

                <div>
                  <label htmlFor="edit-bio" className="block text-xs font-medium text-[#475569] dark:text-[#94A3B8] mb-1">
                    Sobre você
                  </label>
                  <textarea
                    id="edit-bio"
                    rows={2}
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-sm px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                  />
                </div>

                <details className="bg-[#F8FAFC] dark:bg-[#0D1117] rounded-xl p-3 text-xs">
                  <summary className="font-medium text-[#475569] dark:text-[#94A3B8] cursor-pointer">
                    Informações acadêmicas opcionais (ORCID / Área)
                  </summary>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2.5">
                    <input
                      type="text"
                      value={editSpecialty}
                      onChange={(e) => setEditSpecialty(e.target.value)}
                      placeholder="Área de estudo"
                      aria-label="Área de estudo"
                      className="w-full bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#F0F6FC] text-xs px-3 py-2 rounded-lg"
                    />
                    <input
                      type="text"
                      value={editOrcid}
                      onChange={(e) => setEditOrcid(e.target.value)}
                      placeholder="ORCID (se tiver)"
                      aria-label="ORCID"
                      className="w-full bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#F0F6FC] font-mono text-xs px-3 py-2 rounded-lg"
                    />
                  </div>
                </details>

                <label className="inline-flex items-center gap-2 text-xs text-[#0F172A] dark:text-[#F0F6FC] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editOpenToContrib}
                    onChange={(e) => setEditOpenToContrib(e.target.checked)}
                    className="rounded accent-[#1E3A8A]"
                  />
                  <span>Receber mensagens e convites na comunidade</span>
                </label>

                {profileNotice && (
                  <div role="status" className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs text-[#15803D] dark:text-[#4ADE80] flex items-center gap-1.5">
                    <Check className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                    <span>{profileNotice}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full min-h-[42px] py-2 px-4 bg-[#1E3A8A] dark:bg-[#2563EB] hover:bg-[#1E40AF] dark:hover:bg-[#1D4ED8] text-[#FFFFFF] text-sm font-medium rounded-xl transition-colors cursor-pointer"
              >
                Salvar Perfil
              </button>
            </form>
          </section>

          <section className="lg:col-span-5 bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-poppins text-base font-bold text-[#0F172A] dark:text-[#F0F6FC] flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#1E3A8A] dark:text-[#60A5FA]" strokeWidth={1.75} aria-hidden="true" />
                <span>Senha &amp; Cópia de Segurança</span>
              </h2>
            </div>

            {activeAccountRecord && (
              <form onSubmit={handlePasswordChange} className="space-y-3 bg-[#F8FAFC] dark:bg-[#0D1117] p-4 rounded-xl">
                <div className="text-xs font-semibold text-[#0F172A] dark:text-[#F0F6FC]">
                  Trocar minha senha
                </div>
                <input
                  type="password"
                  required
                  value={curPwd}
                  onChange={(e) => setCurPwd(e.target.value)}
                  placeholder="Senha atual"
                  aria-label="Senha atual"
                  className="w-full bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#F0F6FC] text-sm px-3 py-2 rounded-lg"
                />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="Nova senha (mín. 8 caracteres)"
                  aria-label="Nova senha"
                  className="w-full bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#F0F6FC] text-sm px-3 py-2 rounded-lg"
                />
                {pwdError && <div className="text-xs text-[#B91C1C] dark:text-[#FCA5A5]">{pwdError}</div>}
                {pwdMessage && <div className="text-xs text-[#15803D] dark:text-[#4ADE80]">{pwdMessage}</div>}
                <button
                  type="submit"
                  className="w-full py-2 px-3 rounded-lg bg-[#1E3A8A] dark:bg-[#2563EB] text-xs font-medium text-[#FFFFFF] cursor-pointer"
                >
                  Atualizar Senha
                </button>
              </form>
            )}

            <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117] space-y-2.5">
              <div className="text-xs font-semibold text-[#0F172A] dark:text-[#F0F6FC]">
                Guardar uma cópia dos seus dados
              </div>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
                Baixe um arquivo com seu perfil e pesquisas publicadas para guardar onde preferir.
              </p>
              <button
                type="button"
                onClick={handleExportAccountBackup}
                className="w-full py-2 px-3 rounded-lg bg-[#FFFFFF] dark:bg-[#161B22] hover:bg-[#F1F5F9] text-xs font-medium text-[#0F172A] dark:text-[#F0F6FC] inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#2DD4BF]" strokeWidth={1.75} />
                <span>Baixar Meus Dados</span>
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
