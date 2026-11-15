import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnalogueSite, CollaboratorProfile, GeologicalSample, LatestAiAnalysisSnapshot, PlanetaryTarget } from '../types';
import { HARDCODED_API_ENDPOINTS, fetchOfficialElevation, fetchOfficialNasaEvents, NasaEonetEventItem } from '../services/officialApis';
import {
  computeAnalogueFidelity,
  generateSpectralReflectanceCurve,
  parseUserInjectedData,
} from '../services/spectralEngine';
import { computeSampleFingerprint } from '../services/fingerprint';
import { AnalogueDashboard } from './AnalogueDashboard';
import { NasaDataShortcutsModal, NasaShortcutFilter } from './NasaDataShortcutsModal';
import { InteractiveSiteMap, InteractiveSiteMapHandle, MapPickedPoint } from './InteractiveSiteMap';
import {
  DWARF_PLANET_BODIES,
  getCelestialBodyFullLabel,
  getCelestialBodyLabel,
  PLANET_BODIES,
  SATELLITE_BODIES,
} from '../data/celestialBodies';
import {
  Camera,
  MapPin,
  Upload,
  RefreshCw,
  Mountain,
  Satellite,
  FileText,
  Cpu,
  CheckCircle2,
  AlertCircle,
  MessageSquareText,
  FileSpreadsheet,
  Send,
  X,
  Check,
  Download,
  Printer,
  Copy,
  ShieldCheck,
  Database,
  Activity,
  Video,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  FileCode2,
  Sparkles,
  Search,
  Flame,
} from 'lucide-react';
import {
  processUploadedScientificImage,
  isProbablyEncryptedOrTiffFile,
  detectImageMagic,
  DecryptionAlgorithm,
  DecodedImageMetadata,
} from '../services/cryptoImageProcessor';

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  reasoning?: string;
  attachmentName?: string;
}

interface VisualTelemetry {
  width: number;
  height: number;
  meanRed: number;
  meanGreen: number;
  meanBlue: number;
  brightnessAlbedo: number;
  ironOxideIndex: number;
  surfaceContrast: number;
  dominantColorTag: string;
}

async function extractVisualTelemetry(dataUrl: string): Promise<VisualTelemetry | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const sampleSize = 128;
        const canvas = document.createElement('canvas');
        canvas.width = sampleSize;
        canvas.height = sampleSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
        const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize);
        const totalPx = sampleSize * sampleSize;
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        const lumList: number[] = [];

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          sumR += r;
          sumG += g;
          sumB += b;
          lumList.push((0.299 * r + 0.587 * g + 0.114 * b) / 255);
        }

        const meanRed = Math.round(sumR / totalPx);
        const meanGreen = Math.round(sumG / totalPx);
        const meanBlue = Math.round(sumB / totalPx);
        const meanLum = lumList.reduce((a, b) => a + b, 0) / totalPx;
        const variance =
          lumList.reduce((acc, l) => acc + Math.pow(l - meanLum, 2), 0) / totalPx;
        const surfaceContrast = Math.round(Math.sqrt(variance) * 100) / 100;
        const brightnessAlbedo = Math.round(meanLum * 100) / 100;
        const ironOxideIndex =
          Math.round(((meanRed - meanBlue) / (meanRed + meanBlue + 1)) * 100) / 100;

        let dominantColorTag = 'Terreno neutro / rocha cinza';
        if (brightnessAlbedo >= 0.72) {
          dominantColorTag = 'Crosta clara evaporítica / salina ou gelo brilhante';
        } else if (brightnessAlbedo <= 0.28) {
          dominantColorTag = 'Rocha escura basáltica / vulcânica';
        } else if (ironOxideIndex >= 0.18 && meanRed > meanBlue + 25) {
          dominantColorTag = 'Solo/rocha avermelhada ou ocre (óxido de ferro)';
        } else if (meanRed > 150 && meanGreen > 125 && meanBlue < 120) {
          dominantColorTag = 'Areia desértica / regolito ocre-amarelado';
        }

        resolve({
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          meanRed,
          meanGreen,
          meanBlue,
          brightnessAlbedo,
          ironOxideIndex,
          surfaceContrast,
          dominantColorTag,
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

type DiagnosticPathway =
  | 'selected_target_match'
  | 'mars_jezero_match'
  | 'moon_shackleton_match'
  | 'europa_ice_brine_match'
  | 'enceladus_serpentine_plume'
  | 'titan_hydrocarbon_dune'
  | 'venus_supercritical_volcano'
  | 'rover_instrument_simulation'
  | 'extremophile_biosignature'
  | 'isru_resource_detection';

interface UnifiedResearchWorkspaceProps {
  sites: AnalogueSite[];
  selectedSite: AnalogueSite;
  activeSample: GeologicalSample;
  currentUser?: CollaboratorProfile | null;
  visionData: any | null;
  attachedDiagnostics: string | null;
  latestAiAnalysis?: LatestAiAnalysisSnapshot | null;
  onSelectSite: (site: AnalogueSite) => void;
  onSaveSample: (sample: GeologicalSample) => void;
  onInjectBulkSamples: (samples: Partial<GeologicalSample>[]) => void;
  onVisionComplete: (visionData: any, coords?: { lat: number; lng: number }) => void;
  onAttachDiagnostics: (text: string) => void;
  onUpdateAiSnapshot?: (patch: Partial<LatestAiAnalysisSnapshot>) => void;
  onOpenPublishFromAi?: () => void;
}

export const UnifiedResearchWorkspace: React.FC<UnifiedResearchWorkspaceProps> = ({
  sites,
  selectedSite,
  activeSample,
  currentUser,
  visionData,
  attachedDiagnostics,
  latestAiAnalysis,
  onSelectSite,
  onSaveSample,
  onInjectBulkSamples,
  onVisionComplete,
  onAttachDiagnostics,
  onUpdateAiSnapshot,
  onOpenPublishFromAi,
}) => {
  // --- Unified Left Panel Mode: Manual Data Entry (Primary) | AI Copilot | Computer Vision Copilot ---
  const [inputMode, setInputMode] = useState<'prompt_doc' | 'data_form' | 'vision'>('data_form');

  // --- Optional Real-Time GPS States ---
  const [useLocationForAI, setUseLocationForAI] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsNote, setGpsNote] = useState<string | null>(null);

  // --- Prompt / Doc / CSV Analyst States ---
  const [targetPlanet, setTargetPlanet] = useState<PlanetaryTarget>(activeSample.targetPlanet || 'Mars');
  const [researchPrompt, setResearchPrompt] = useState('');
  const [attachedDocName, setAttachedDocName] = useState<string | null>(null);
  const [attachedDocContent, setAttachedDocContent] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // --- Unified Structured Data Form States ---
  const [sampleName, setSampleName] = useState(activeSample.name);
  const [officialSource, setOfficialSource] = useState(activeSample.officialSource || 'NASA PDS / Campo Oficial');
  const [collectorName, setCollectorName] = useState(activeSample.collectorName);
  const [institution, setInstitution] = useState(activeSample.institution);
  const [siteId, setSiteId] = useState(activeSample.siteId);
  const [customLocation, setCustomLocation] = useState(activeSample.customLocation || selectedSite.name);
  const [waterActivity, setWaterActivity] = useState(activeSample.waterActivity);
  const [pH, setPH] = useState(activeSample.pH);
  const [depthCm, setDepthCm] = useState(activeSample.depthCm);
  const [porosityPercent, setPorosityPercent] = useState(activeSample.porosityPercent);
  const [minerals, setMinerals] = useState<{ [mineral: string]: number }>(activeSample.minerals);
  const [mineralsManualText, setMineralsManualText] = useState(
    Object.entries(activeSample.minerals)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')
  );
  const [fieldNotes, setFieldNotes] = useState(activeSample.fieldNotes);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Sync form when activeSample changes externally
  useEffect(() => {
    setSampleName(activeSample.name);
    setOfficialSource(activeSample.officialSource);
    setCollectorName(activeSample.collectorName);
    setInstitution(activeSample.institution);
    setTargetPlanet(activeSample.targetPlanet);
    setSiteId(activeSample.siteId);
    const matchedSite = sites.find((s) => s.id === activeSample.siteId);
    setCustomLocation(activeSample.customLocation || matchedSite?.name || selectedSite.name);
    setWaterActivity(activeSample.waterActivity);
    setPH(activeSample.pH);
    setDepthCm(activeSample.depthCm);
    setPorosityPercent(activeSample.porosityPercent);
    setMinerals(activeSample.minerals);
    setMineralsManualText(
      Object.entries(activeSample.minerals)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
    );
    setFieldNotes(activeSample.fieldNotes);
  }, [activeSample, selectedSite.name, sites]);

  const liveAFI = useMemo(() => {
    return computeAnalogueFidelity(
      { targetPlanet, waterActivity, pH, depthCm, porosityPercent, minerals },
      targetPlanet,
      sites.find((s) => s.id === siteId) || selectedSite
    );
  }, [targetPlanet, waterActivity, pH, depthCm, porosityPercent, minerals, siteId, sites, selectedSite]);

  // --- Computer Vision & Real-Time Camera + TIFF / Encrypted Image States ---
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedMimeType, setUploadedMimeType] = useState<string>('image/jpeg');
  const [rasterMetadata, setRasterMetadata] = useState<DecodedImageMetadata | null>(null);
  const [pendingEncryptedFile, setPendingEncryptedFile] = useState<File | null>(null);
  const [showDecryptPanel, setShowDecryptPanel] = useState(false);
  const [decryptKey, setDecryptKey] = useState('');
  const [showDecryptKey, setShowDecryptKey] = useState(false);
  const [decryptAlgorithm, setDecryptAlgorithm] = useState<DecryptionAlgorithm>('auto');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [isAnalyzingVision, setIsAnalyzingVision] = useState(false);
  const [visionResult, setVisionResult] = useState<any | null>(visionData);
  const [visionError, setVisionError] = useState<string | null>(null);
  const [visualTelemetry, setVisualTelemetry] = useState<VisualTelemetry | null>(null);
  const [visualNotes, setVisualNotes] = useState('');

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  useEffect(() => {
    if (isCameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isCameraOpen]);

  useEffect(() => {
    if (inputMode !== 'vision') {
      stopCameraStream();
    }
  }, [inputMode]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // --- Map States (NASA SRTM DEM Topography Default + Live NASA EONET Events) ---
  const mapRef = useRef<InteractiveSiteMapHandle>(null);
  const [filterRegionOrPlanet, setFilterRegionOrPlanet] = useState<string>('ALL');
  const [siteSearchQuery, setSiteSearchQuery] = useState('');
  const [showNasaEvents, setShowNasaEvents] = useState(false);
  const [nasaEvents, setNasaEvents] = useState<NasaEonetEventItem[]>([]);
  const [nasaEventsLoading, setNasaEventsLoading] = useState(false);
  const [showNasaModal, setShowNasaModal] = useState(false);
  const [nasaModalFilter, setNasaModalFilter] = useState<NasaShortcutFilter>('all');

  const openNasaShortcuts = (filter: NasaShortcutFilter = 'all') => {
    setNasaModalFilter(filter);
    setShowNasaModal(true);
  };

  // --- Integrated AI Diagnostics & Report States ---
  const [selectedPathway, setSelectedPathway] = useState<DiagnosticPathway>('mars_jezero_match');
  const [isDiagLoading, setIsDiagLoading] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<string | null>(attachedDiagnostics);
  const [diagReasoning, setDiagReasoning] = useState<string | null>(null);
  const [diagError, setDiagError] = useState<string | null>(null);

  const [reportText, setReportText] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);

  const reportSectionRef = useRef<HTMLElement>(null);

  const filteredSites = useMemo(() => sites.filter((s) => {
    const regionOk =
      filterRegionOrPlanet === 'ALL'
        ? true
        : filterRegionOrPlanet === 'AFRICA'
        ? s.region === 'África'
        : s.targetPlanet === filterRegionOrPlanet || s.targetPlanet === 'Both';
    if (!regionOk) return false;
    const q = siteSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.country.toLowerCase().includes(q) ||
      s.region.toLowerCase().includes(q) ||
      s.targetPlanet.toLowerCase().includes(q) ||
      s.primaryMinerals.some((m) => m.toLowerCase().includes(q))
    );
  }), [sites, filterRegionOrPlanet, siteSearchQuery]);

  const handleMapSelectSite = useCallback(
    (site: AnalogueSite) => {
      onSelectSite(site);
      setTargetPlanet(site.targetPlanet);
      setSiteId(site.id);
    },
    [onSelectSite]
  );

  const handleUseMapPoint = (point: MapPickedPoint) => {
    setCurrentCoords({ lat: point.lat, lng: point.lng });
    setGpsAccuracy(null);
    setUseLocationForAI(true);
    const parts = [`Ponto escolhido no mapa (${point.lat.toFixed(4)}°, ${point.lng.toFixed(4)}°)`];
    if (point.elevationMeters !== null) parts.push(`altitude SRTM ${point.elevationMeters} m`);
    if (point.nearestSite && point.nearestDistanceKm !== null) {
      parts.push(`análogo mais próximo: ${point.nearestSite.name} a ${Math.round(point.nearestDistanceKm)} km`);
    }
    setGpsNote(parts.join(' · ') + '.');
  };

  const handleToggleNasaEvents = async () => {
    const next = !showNasaEvents;
    setShowNasaEvents(next);
    if (next && nasaEvents.length === 0) {
      setNasaEventsLoading(true);
      try {
        const list = await fetchOfficialNasaEvents();
        setNasaEvents(list);
      } finally {
        setNasaEventsLoading(false);
      }
    }
  };

  const handleActivateNasaEventsOnMap = async () => {
    setShowNasaEvents(true);
    if (nasaEvents.length === 0) {
      setNasaEventsLoading(true);
      try {
        const list = await fetchOfficialNasaEvents();
        setNasaEvents(list);
      } finally {
        setNasaEventsLoading(false);
      }
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setGpsNote('Geolocalização não suportada neste navegador.');
      return;
    }

    setGpsLoading(true);
    setGpsNote(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          lat: parseFloat(position.coords.latitude.toFixed(5)),
          lng: parseFloat(position.coords.longitude.toFixed(5)),
        };
        setCurrentCoords(coords);
        setGpsAccuracy(Math.round(position.coords.accuracy));
        setUseLocationForAI(true);
        setGpsLoading(false);
        mapRef.current?.flyTo([coords.lat, coords.lng], 7);
        const dem = await fetchOfficialElevation(coords.lat, coords.lng);
        if (dem.elevationMeters !== null) {
          setGpsNote(`Altitude SRTM oficial: ${dem.elevationMeters} m (${dem.dataset})`);
        }
      },
      (err) => {
        setGpsNote(`Permissão GPS indisponível (${err.message}). Coordenadas do sítio selecionado disponíveis.`);
        setCurrentCoords({
          lat: selectedSite.coordinates[0],
          lng: selectedSite.coordinates[1],
        });
        setGpsLoading(false);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  // Handle bulk CSV/JSON dataset injection directly in the unified workspace
  const handleBulkDataUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportNotice(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseUserInjectedData(text, file.name);
        onInjectBulkSamples(parsed);
        setAttachedDocName(file.name);
        setAttachedDocContent(text);
        const incomplete = parsed.filter((row) => row.unmeasured.length > 0).length;
        setImportNotice(
          `${parsed.length} registo(s) carregado(s) de ${file.name}.` +
            (incomplete > 0
              ? ` ${incomplete} com campos em falta (marcados como não medidos e excluídos do cálculo de semelhança).`
              : '')
        );
      } catch (err: any) {
        setImportError(err.message || 'Falha ao processar arquivo CSV ou JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Document attachment for AI chat
  const handleDocumentAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setChatError(null);
    setAttachedDocName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachedDocContent((event.target?.result as string) || '');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Run Prompt / Doc / CSV AI Analyst
  const handleRunResearchChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!researchPrompt.trim() && !attachedDocContent) {
      setChatError('Escreva uma pergunta/descrição ou anexe um arquivo CSV/TXT/JSON para análise.');
      return;
    }

    setIsChatLoading(true);
    setChatError(null);

    const userText =
      researchPrompt.trim() ||
      `Analise o documento anexado (${attachedDocName}) para identificar os prós, contras e sítio análogo ideal em ${targetPlanet}.`;

    const nextHistory: ChatMessage[] = [
      ...chatHistory,
      { role: 'user', content: userText, attachmentName: attachedDocName || undefined },
    ];
    setChatHistory(nextHistory);
    setResearchPrompt('');

    try {
      const coordsToSend = useLocationForAI
        ? currentCoords || { lat: selectedSite.coordinates[0], lng: selectedSite.coordinates[1] }
        : undefined;

      const response = await fetch(HARDCODED_API_ENDPOINTS.BACKEND_CHAT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextHistory.map((m) => ({ role: m.role, content: m.content })),
          prompt: userText,
          documentContent: attachedDocContent,
          documentName: attachedDocName,
          targetPlanet,
          coordinates: coordsToSend,
          useLocation: useLocationForAI,
          siteContext: selectedSite,
          activeSample,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Erro HTTP ${response.status}`);
      }

      const data = await response.json();
      setChatHistory([
        ...nextHistory,
        {
          role: 'model',
          content: data.reply || 'Análise concluída.',
          reasoning: data.reasoning || undefined,
        },
      ]);
      if (data.reply) {
        onAttachDiagnostics(data.reply);
        onUpdateAiSnapshot?.({
          targetPlanet,
          chatReply: data.reply,
        });
      }
    } catch (err: any) {
      setChatError(err.message || 'Falha ao consultar o copiloto IA.');
    } finally {
      setIsChatLoading(false);
    }
  };

  const parseManualMineralsInput = (text: string): Record<string, number> => {
    const map: Record<string, number> = {};
    const parts = text
      .split(/[,;\n]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    parts.forEach((part) => {
      const m = part.match(/^(.+?)\s*[:=]\s*(\d+(?:[.,]\d+)?)/);
      if (m) {
        map[m[1].trim()] = Math.max(1, parseFloat(m[2].replace(',', '.')));
      } else {
        map[part] = 0;
      }
    });
    const keys = Object.keys(map);
    if (keys.length === 0) return minerals;
    const zeroKeys = keys.filter((k) => map[k] === 0);
    if (zeroKeys.length > 0) {
      const assigned = keys.reduce((acc, k) => acc + map[k], 0);
      const rem = Math.max(10, 100 - assigned);
      const each = Math.max(5, Math.round(rem / zeroKeys.length));
      zeroKeys.forEach((k) => {
        map[k] = each;
      });
    }
    return map;
  };

  // Save Structured Manual Sample Data directly into Dashboard & Network
  const handleSaveDataForm = (e: React.FormEvent) => {
    e.preventDefault();
    const typedLocation = customLocation.trim();
    const matchedByText = typedLocation
      ? sites.find(
          (s) =>
            s.name.toLowerCase() === typedLocation.toLowerCase() ||
            typedLocation.toLowerCase().includes(s.name.toLowerCase())
        )
      : undefined;
    const chosenSite = matchedByText || sites.find((s) => s.id === siteId) || selectedSite;
    const finalLocation = typedLocation || chosenSite.name;
    const parsedMinerals = parseManualMineralsInput(mineralsManualText);
    const manualAFI = computeAnalogueFidelity(
      { targetPlanet, waterActivity, pH, depthCm, porosityPercent, minerals: parsedMinerals },
      targetPlanet,
      chosenSite
    );
    const curve = generateSpectralReflectanceCurve(parsedMinerals);

    const updated: GeologicalSample = {
      ...activeSample,
      id: `smp-${Date.now().toString().slice(-6)}`,
      name: sampleName,
      collaboratorId: currentUser ? currentUser.id : activeSample.collaboratorId,
      collectorName: currentUser ? currentUser.name : collectorName,
      institution: currentUser ? currentUser.institution : institution,
      officialSource: officialSource.trim() || 'Registro Manual do Pesquisador',
      targetPlanet,
      siteId: chosenSite.id,
      customLocation: finalLocation,
      coordinates: currentCoords ? [currentCoords.lat, currentCoords.lng] : chosenSite.coordinates,
      waterActivity,
      pH,
      depthCm,
      porosityPercent,
      minerals: parsedMinerals,
      spectralCurve: curve,
      fidelityScores: manualAFI,
      fieldNotes,
      collectedAt: new Date().toISOString().split('T')[0],
      hash: '',
      version: 'v1.0.0-manual',
      publishedAt: new Date().toISOString(),
      status: 'under_review',
      // Manually entered values are measurements; clear any import placeholders.
      unmeasured: Object.keys(parsedMinerals).length === 0 ? ['minerals'] : [],
    };
    updated.hash = computeSampleFingerprint(updated);

    onSaveSample(updated);
    onSelectSite(chosenSite);
    setImportNotice(`Dados manuais de "${updated.name}" (${finalLocation}) salvos no painel!`);
    setTimeout(() => setImportNotice(null), 4000);
  };

  const applyProcessedScientificImage = async (
    file: File,
    secretKey?: string,
    algorithm?: DecryptionAlgorithm
  ) => {
    setIsDecrypting(true);
    setDecryptError(null);
    setVisionError(null);

    try {
      const processed = await processUploadedScientificImage(file, {
        secretKey,
        algorithm: algorithm || decryptAlgorithm,
      });

      setUploadedImage(processed.dataUrl);
      setUploadedFileName(file.name);
      setUploadedMimeType(processed.mimeType);
      setRasterMetadata(processed.metadata);
      setVisionResult(null);
      setPendingEncryptedFile(null);
      setShowDecryptPanel(false);
      extractVisualTelemetry(processed.dataUrl).then((tel) => setVisualTelemetry(tel));

      if (processed.metadata.geoCoords) {
        setCurrentCoords(processed.metadata.geoCoords);
        setUseLocationForAI(true);
        setGpsNote(
          `Coordenadas extraídas do GeoTIFF (${processed.metadata.geoCoords.lat.toFixed(4)}°, ${processed.metadata.geoCoords.lng.toFixed(4)}°).`
        );
        mapRef.current?.flyTo([processed.metadata.geoCoords.lat, processed.metadata.geoCoords.lng], 7);
      }
    } catch (err: any) {
      setPendingEncryptedFile(file);
      setShowDecryptPanel(true);
      setDecryptError(
        err?.message ||
          'Arquivo requer chave/senha de descriptografia ou está num formato criptografado não suportado.'
      );
    } finally {
      setIsDecrypting(false);
    }
  };

  // Computer Vision Upload (Photos, TIFF/GeoTIFF & Encrypted NASA/Field Datasets), Live Camera & Run
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopCameraStream();
    setVisionError(null);
    setCameraError(null);
    setDecryptError(null);
    setRasterMetadata(null);
    setUploadedFileName(file.name);

    try {
      const headerBuf = await file.slice(0, 64).arrayBuffer();
      const headerMagic = detectImageMagic(new Uint8Array(headerBuf));
      const flags = isProbablyEncryptedOrTiffFile(file.name, file.type);

      const requiresPasswordFirst =
        (flags.isEncrypted ||
          headerMagic === 'openssl' ||
          headerMagic === 'json' ||
          (headerMagic === 'unknown' && !flags.isStandardImage && !flags.isTiff)) &&
        !decryptKey.trim();

      if (requiresPasswordFirst) {
        // Attempt direct Base64/Hex unwrap first in case it's unencrypted armored payload
        if (headerMagic === 'unknown' && !flags.isEncrypted) {
          await applyProcessedScientificImage(file, '', decryptAlgorithm);
        } else {
          setPendingEncryptedFile(file);
          setShowDecryptPanel(true);
          setUploadedImage(null);
        }
      } else {
        await applyProcessedScientificImage(file, decryptKey, decryptAlgorithm);
      }
    } catch (err: any) {
      setVisionError(err?.message || 'Erro ao ler o arquivo selecionado.');
    } finally {
      e.target.value = '';
    }
  };

  const handleDecryptPendingFile = async () => {
    if (!pendingEncryptedFile) {
      setDecryptError('Carregue primeiro um arquivo de imagem ou GeoTIFF criptografado.');
      return;
    }
    await applyProcessedScientificImage(pendingEncryptedFile, decryptKey, decryptAlgorithm);
  };

  const handleOpenCamera = async () => {
    setVisionError(null);
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Câmera em tempo real não suportada neste navegador. Utilize o upload de fotografia.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setIsCameraOpen(true);
    } catch (err: any) {
      const msg =
        err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
          ? 'Permissão de câmera negada. Autorize o acesso à câmera no navegador para capturar em tempo real.'
          : `Não foi possível acessar a câmera (${err?.message || 'dispositivo indisponível'}).`;
      setCameraError(msg);
      setIsCameraOpen(false);
    }
  };

  const handleCaptureCameraFrame = async (analyzeImmediately = false) => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      setCameraError('Aguardando inicialização da imagem da câmera...');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const capturedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    setUploadedImage(capturedDataUrl);
    setUploadedFileName(`camera-campo-${stamp}.jpg`);
    setUploadedMimeType('image/jpeg');
    setRasterMetadata(null);
    setPendingEncryptedFile(null);
    setShowDecryptPanel(false);
    setVisionResult(null);
    stopCameraStream();

    const capturedTel = await extractVisualTelemetry(capturedDataUrl);
    setVisualTelemetry(capturedTel);

    if (analyzeImmediately) {
      await handleRunVisionAnalysis(capturedDataUrl, 'image/jpeg', null, capturedTel);
    }
  };

  const handleRunVisionAnalysis = async (
    imageOverride?: string,
    mimeOverride?: string,
    rasterOverride?: DecodedImageMetadata | null,
    telemetryOverride?: VisualTelemetry | null
  ) => {
    const targetImg = imageOverride || uploadedImage;
    if (!targetImg) {
      setVisionError('Capture uma imagem pela câmera, carregue um TIFF/GeoTIFF ou descriptografe um arquivo antes de analisar.');
      return;
    }

    setIsAnalyzingVision(true);
    setVisionError(null);

    try {
      const coordsToUse = useLocationForAI
        ? currentCoords || { lat: selectedSite.coordinates[0], lng: selectedSite.coordinates[1] }
        : undefined;

      const resolvedTelemetry =
        telemetryOverride !== undefined
          ? telemetryOverride
          : visualTelemetry || (await extractVisualTelemetry(targetImg));
      if (resolvedTelemetry && !visualTelemetry) {
        setVisualTelemetry(resolvedTelemetry);
      }

      const response = await fetch(HARDCODED_API_ENDPOINTS.BACKEND_VISION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // The image itself stays in the browser; only measured telemetry is sent.
          coordinates: coordsToUse,
          targetPlanet,
          rasterMetadata: rasterOverride !== undefined ? rasterOverride : rasterMetadata,
          visualTelemetry: resolvedTelemetry,
          visualNotes: visualNotes.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Erro HTTP ${response.status}`);
      }

      const data = await response.json();
      setVisionResult(data);
      onVisionComplete(data, coordsToUse);
      const rawVisionMinerals = data.detectedMinerals ?? data.minerals;
      const detectedMineralsList: string[] = Array.isArray(rawVisionMinerals)
        ? rawVisionMinerals
        : typeof rawVisionMinerals === 'string'
        ? rawVisionMinerals.split(/[,;]+/).map((m: string) => m.trim()).filter(Boolean)
        : [];
      onUpdateAiSnapshot?.({
        targetPlanet,
        visionClosestAnalogue: data.closestAnalogue,
        visionMinerals: detectedMineralsList,
        visionScore:
          typeof data.estimatedFidelityScore === 'number'
            ? data.estimatedFidelityScore
            : typeof data.fidelityScore === 'number'
            ? data.fidelityScore
            : undefined,
      });
    } catch (err: any) {
      setVisionError(err.message || 'Falha ao executar análise visual com o copiloto.');
    } finally {
      setIsAnalyzingVision(false);
    }
  };

  // Execute Specialized AI Diagnostic Pathway
  const activeTargetLabel = getCelestialBodyFullLabel(activeSample.targetPlanet);
  const pathways: { id: DiagnosticPathway; category: string; title: string; description: string; primary?: boolean }[] = [
    ...(activeSample.targetPlanet !== 'Mars' && activeSample.targetPlanet !== 'Moon'
      ? [
          {
            id: 'selected_target_match' as DiagnosticPathway,
            category: getCelestialBodyLabel(activeSample.targetPlanet),
            title: `Comparar com ${activeTargetLabel}`,
            description: `Avalia os dados manuais, minerais e ambiente da amostra para o estudo de ${activeTargetLabel}.`,
            primary: true,
          },
        ]
      : []),
    {
      id: 'mars_jezero_match',
      category: 'Marte',
      title: 'Comparar com Marte',
      description: 'Verifica se o solo e os minerais combinam com antigas regiões de água em Marte.',
      primary: true,
    },
    {
      id: 'moon_shackleton_match',
      category: 'Lua',
      title: 'Comparar com a Lua',
      description: 'Avalia se o terreno se parece com crateras e poeira lunar para futuras bases.',
      primary: true,
    },
    {
      id: 'extremophile_biosignature',
      category: 'Vida & Água',
      title: 'Chance de Água e Vida',
      description: 'Analisa condições de umidade, sais e proteção contra o sol para vida microscópica.',
      primary: true,
    },
    {
      id: 'isru_resource_detection',
      category: 'Recursos',
      title: 'Recursos Úteis no Local',
      description: 'Estima se é possível extrair água ou oxigênio das rochas e do solo.',
      primary: true,
    },
    {
      id: 'europa_ice_brine_match',
      category: 'Europa',
      title: 'Lua gelada Europa',
      description: 'Compara sais e crostas minerais com oceanos congelados de Júpiter.',
    },
    {
      id: 'enceladus_serpentine_plume',
      category: 'Encélado',
      title: 'Plumas de Encélado',
      description: 'Avalia fontes minerais alcalinas semelhantes às de Encélado em Saturno.',
    },
    {
      id: 'titan_hydrocarbon_dune',
      category: 'Titã',
      title: 'Dunas de Titã',
      description: 'Compara dunas e ventos com a maior lua de Saturno.',
    },
    {
      id: 'venus_supercritical_volcano',
      category: 'Vênus',
      title: 'Vulcões de Vênus',
      description: 'Avalia rochas vulcânicas submetidas a calor e pressão extremos.',
    },
    {
      id: 'rover_instrument_simulation',
      category: 'Sondas NASA',
      title: 'Simulação de Sonda NASA',
      description: 'Mostra o que os sensores de um robô espacial detectariam neste lugar.',
    },
  ];

  const handleRunDiagnostic = async () => {
    setIsDiagLoading(true);
    setDiagError(null);

    try {
      const response = await fetch(HARDCODED_API_ENDPOINTS.BACKEND_DIAGNOSTICS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: selectedPathway,
          sample: activeSample,
          site: selectedSite,
          targetPlanet: activeSample.targetPlanet,
          coordinates: activeSample.coordinates,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Erro HTTP ${response.status}`);
      }

      const data = await response.json();
      setDiagnosticResult(data.result);
      setDiagReasoning(data.reasoning || null);
      onAttachDiagnostics(data.result);
      onUpdateAiSnapshot?.({
        targetPlanet: activeSample.targetPlanet,
        diagnosticResult: data.result,
      });
    } catch (err: any) {
      setDiagError(err.message || 'Falha ao executar diagnóstico do copiloto IA.');
    } finally {
      setIsDiagLoading(false);
    }
  };

  // Generate Formal Conclusion & Technical Report (Copilot Assist)
  const documentId = `DOC-AA-${activeSample.id.toUpperCase()}-${new Date().getFullYear()}`;
  const documentDate = new Date().toLocaleDateString('pt-BR');

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    setReportError(null);
    reportSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
      const chatSynthesis =
        chatHistory.length > 0
          ? chatHistory.map((m) => `${m.role === 'user' ? 'Pesquisador' : 'Copiloto IA'}: ${m.content}`).join('\n')
          : undefined;

      const combinedDiagnostics = [diagnosticResult, chatSynthesis].filter(Boolean).join('\n\n---\n\n');

      const response = await fetch(HARDCODED_API_ENDPOINTS.BACKEND_REPORT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sample: activeSample,
          site: selectedSite,
          visionData: visionResult,
          attachedDiagnostics: combinedDiagnostics || undefined,
          targetPlanet: activeSample.targetPlanet,
          investigator: currentUser ? `${currentUser.name} (${currentUser.institution})` : activeSample.collectorName,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Erro HTTP ${response.status}`);
      }

      const data = await response.json();
      setReportText(data.report);
      onUpdateAiSnapshot?.({
        targetPlanet: activeSample.targetPlanet,
        reportText: data.report,
        diagnosticResult: diagnosticResult || undefined,
      });
    } catch (e: any) {
      setReportError(e.message || 'Falha ao gerar texto de apoio do copiloto.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleCopyReport = () => {
    if (!reportText) return;
    navigator.clipboard.writeText(reportText);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    if (!reportText) return;
    const blob = new Blob([reportText], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${documentId}_Relatorio_African_Analogs.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* BENTO HEADER VESSEL */}
      <div className="bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors duration-150">
        <div className="space-y-1">
          <h1 className="font-poppins text-2xl sm:text-[28px] font-bold text-[#0F172A] dark:text-[#F0F6FC] tracking-tight">
            Pesquisa
          </h1>
          <p className="text-sm text-[#475569] dark:text-[#94A3B8] max-w-2xl leading-relaxed">
            Explore lugares da Terra parecidos com outros planetas usando perguntas, fotos, dados simples ou o mapa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => openNasaShortcuts('all')}
            className="min-h-[40px] py-2 px-3.5 bg-[#F1F5F9] dark:bg-[#21262D] hover:bg-[#E2E8F0] dark:hover:bg-[#30363D] text-[#0F172A] dark:text-[#F0F6FC] text-xs font-medium rounded-xl transition-colors duration-150 flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Satellite className="w-4 h-4 text-[#1E3A8A] dark:text-[#60A5FA]" strokeWidth={1.75} aria-hidden="true" />
            <span>Fontes da NASA</span>
          </button>

          <label className="min-h-[40px] py-2 px-3.5 bg-[#F1F5F9] dark:bg-[#21262D] hover:bg-[#E2E8F0] dark:hover:bg-[#30363D] text-[#0F172A] dark:text-[#F0F6FC] text-xs font-medium rounded-xl transition-colors duration-150 flex items-center gap-2 cursor-pointer whitespace-nowrap">
            <Upload className="w-4 h-4 text-[#1E3A8A] dark:text-[#60A5FA]" strokeWidth={1.75} aria-hidden="true" />
            <span>Importar Planilha</span>
            <input type="file" accept=".csv,.json" onChange={handleBulkDataUpload} className="sr-only" />
          </label>

          <button
            type="button"
            onClick={handleGetLocation}
            disabled={gpsLoading}
            className="min-h-[40px] py-2 px-3.5 bg-[#F1F5F9] dark:bg-[#21262D] hover:bg-[#E2E8F0] dark:hover:bg-[#30363D] text-[#0F172A] dark:text-[#F0F6FC] text-xs font-medium rounded-xl transition-colors duration-150 flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            {gpsLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin text-[#1E3A8A] dark:text-[#60A5FA]" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <MapPin className="w-4 h-4 text-[#1E3A8A] dark:text-[#60A5FA]" strokeWidth={1.75} aria-hidden="true" />
            )}
            <span>{gpsLoading ? 'Localizando...' : 'Minha Localização'}</span>
          </button>

          <button
            type="button"
            onClick={handleGenerateReport}
            disabled={isGeneratingReport}
            className="min-h-[40px] py-2 px-4 bg-[#1E3A8A] dark:bg-[#2563EB] hover:bg-[#1E40AF] dark:hover:bg-[#1D4ED8] disabled:opacity-50 text-[#FFFFFF] text-xs font-medium rounded-xl transition-colors duration-150 flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <FileText className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
            <span>{isGeneratingReport ? 'Criando resumo...' : 'Criar Resumo'}</span>
          </button>
        </div>
      </div>

      {/* Notices & GPS Ribbon */}
      {(currentCoords || gpsNote || importNotice || importError) && (
        <div className="space-y-2" aria-live="polite">
          {(currentCoords || gpsNote) && (
            <div className="py-2.5 px-4 bg-[#FFFFFF] dark:bg-[#161B22] rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs text-[#0F172A] dark:text-[#F0F6FC]">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#15803D] dark:text-[#4ADE80]" strokeWidth={1.75} aria-hidden="true" />
                {currentCoords && (
                  <span>
                    Sua localização:{' '}
                    <strong className="font-mono tabular-nums">
                      {currentCoords.lat}°, {currentCoords.lng}°
                    </strong>
                    {gpsAccuracy ? ` (precisão ~${gpsAccuracy} m)` : ''}
                  </span>
                )}
              </div>
              {gpsNote && <span className="text-[#B45309] dark:text-[#FBBF24]">{gpsNote}</span>}
            </div>
          )}

          {importNotice && (
            <div className="py-2.5 px-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs text-[#15803D] dark:text-[#4ADE80] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span>{importNotice}</span>
            </div>
          )}

          {importError && (
            <div role="alert" className="py-2.5 px-4 bg-red-50 dark:bg-red-950/40 rounded-xl text-xs text-[#B91C1C] dark:text-[#FCA5A5] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span>{importError}</span>
            </div>
          )}
        </div>
      )}

      {/* BENTO ROW 1: INPUT BOWL (5 cols) + MAP BOWL (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* LEFT BOWL (5 cols): Ask AI | Send Data | Photo / Camera */}
        <section
          aria-labelledby="unified-input-heading"
          className="lg:col-span-5 bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-5 transition-colors duration-150"
        >
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <h2 id="unified-input-heading" className="font-poppins text-base font-bold text-[#0F172A] dark:text-[#F0F6FC]">
                  Dados da Pesquisa &amp; Copiloto
                </h2>
                <span
                  className="text-xs font-medium text-[#1E3A8A] dark:text-[#60A5FA] bg-[#F1F5F9] dark:bg-[#21262D] px-2.5 py-1 rounded-lg cursor-help"
                  title={liveAFI.notes.join('\n')}
                >
                  Semelhança: <strong className="font-mono tabular-nums">{liveAFI.total}%</strong>
                  {liveAFI.coverage < 1 && (
                    <span className="ml-1 text-[#B45309] dark:text-[#FBBF24]">
                      · dados {Math.round(liveAFI.coverage * 100)}%
                    </span>
                  )}
                </span>
              </div>
              <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                Você insere os dados manualmente; a IA atua apenas como copiloto para analisar.
              </p>
              <details className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                <summary className="cursor-pointer select-none">Como a semelhança é calculada</summary>
                <ul className="mt-1.5 space-y-0.5 list-disc pl-4">
                  {liveAFI.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </details>
            </div>

            {/* Segmented Switcher: Manual Data First + AI Copilot + Vision Copilot */}
            <div
              role="tablist"
              aria-label="Entrada manual e copiloto de análise"
              className="grid grid-cols-3 gap-1.5 p-1.5 bg-[#F1F5F9] dark:bg-[#0D1117] rounded-xl"
            >
              <button
                type="button"
                role="tab"
                aria-selected={inputMode === 'data_form'}
                onClick={() => setInputMode('data_form')}
                className={`min-h-[38px] py-1.5 px-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  inputMode === 'data_form'
                    ? 'bg-[#FFFFFF] dark:bg-[#21262D] text-[#1E3A8A] dark:text-[#F0F6FC] font-semibold shadow-xs'
                    : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F0F6FC]'
                }`}
              >
                <Database className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <span className="truncate">Dados Manuais</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={inputMode === 'prompt_doc'}
                onClick={() => setInputMode('prompt_doc')}
                className={`min-h-[38px] py-1.5 px-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  inputMode === 'prompt_doc'
                    ? 'bg-[#FFFFFF] dark:bg-[#21262D] text-[#1E3A8A] dark:text-[#F0F6FC] font-semibold shadow-xs'
                    : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F0F6FC]'
                }`}
              >
                <MessageSquareText className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <span className="truncate">Copiloto IA</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={inputMode === 'vision'}
                onClick={() => setInputMode('vision')}
                className={`min-h-[38px] py-1.5 px-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  inputMode === 'vision'
                    ? 'bg-[#FFFFFF] dark:bg-[#21262D] text-[#1E3A8A] dark:text-[#F0F6FC] font-semibold shadow-xs'
                    : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F0F6FC]'
                }`}
              >
                <Camera className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <span className="truncate">Foto / Câmera</span>
              </button>
            </div>

            {/* Target Planet & Natural Satellite Dropdown Selector */}
            <div className="space-y-1.5">
              <label htmlFor="u-target-planet-select" className="text-xs font-medium text-[#475569] dark:text-[#94A3B8] block">
                Comparar com qual planeta ou satélite natural?
              </label>
              <select
                id="u-target-planet-select"
                value={targetPlanet}
                onChange={(e) => setTargetPlanet(e.target.value as PlanetaryTarget)}
                className="w-full min-h-[40px] bg-[#F1F5F9] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-sm font-medium px-3.5 py-2 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] dark:focus-visible:ring-[#60A5FA] cursor-pointer"
              >
                <optgroup label="Planetas do Sistema Solar">
                  {PLANET_BODIES.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.optionLabel}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Planetas Anões">
                  {DWARF_PLANET_BODIES.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.optionLabel}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Satélites Naturais (Luas)">
                  {SATELLITE_BODIES.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.optionLabel}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Optional Location Toggle */}
            <label className="flex items-center gap-2 text-xs text-[#475569] dark:text-[#94A3B8] bg-[#F8FAFC] dark:bg-[#0D1117] px-3 py-2 rounded-xl cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useLocationForAI}
                onChange={(e) => setUseLocationForAI(e.target.checked)}
                className="w-4 h-4 accent-[#1E3A8A] dark:accent-[#2563EB] rounded cursor-pointer"
              />
              <span className="truncate">
                Incluir local ({currentCoords ? `${currentCoords.lat}°, ${currentCoords.lng}°` : selectedSite.name.split(' (')[0]})
              </span>
            </label>
          </div>

          {/* MODE A: PROMPT / DOCUMENT / CSV */}
          {inputMode === 'prompt_doc' && (
            <form onSubmit={handleRunResearchChat} className="space-y-3.5 flex-1 flex flex-col justify-between">
              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#475569] dark:text-[#94A3B8]">
                      Anexar documento ou planilha (opcional)
                    </span>
                    {attachedDocName && (
                      <button
                        type="button"
                        onClick={() => {
                          setAttachedDocName(null);
                          setAttachedDocContent(null);
                        }}
                        className="text-xs text-[#B91C1C] dark:text-[#F87171] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                        <span>Remover</span>
                      </button>
                    )}
                  </div>

                  <label className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117] hover:bg-[#F1F5F9] dark:hover:bg-[#21262D] transition-colors cursor-pointer">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileSpreadsheet className="w-4 h-4 text-[#1E3A8A] dark:text-[#60A5FA] shrink-0" strokeWidth={1.75} aria-hidden="true" />
                      <span className="text-xs text-[#0F172A] dark:text-[#F0F6FC] truncate">
                        {attachedDocName
                          ? `${attachedDocName} (${attachedDocContent?.split(/\r?\n/).length || 0} linhas)`
                          : 'Escolher arquivo (.CSV, .JSON ou texto)'}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-[#1E3A8A] dark:text-[#60A5FA] shrink-0">Escolher</span>
                    <input type="file" accept=".csv,.json,.txt,.md,.tsv" onChange={handleDocumentUploadSafe(handleDocumentAttach)} className="sr-only" />
                  </label>
                  <button
                    type="button"
                    onClick={() => openNasaShortcuts('datasets')}
                    className="text-[11px] font-medium text-[#1E3A8A] dark:text-[#60A5FA] hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Satellite className="w-3 h-3" strokeWidth={1.75} aria-hidden="true" />
                    <span>Não tem planilha? Ver onde baixar dados CSV/JSON da NASA</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="unified-prompt" className="text-xs font-medium text-[#475569] dark:text-[#94A3B8] block">
                    Sua pergunta ou ideia de pesquisa
                  </label>
                  <textarea
                    id="unified-prompt"
                    rows={3}
                    value={researchPrompt}
                    onChange={(e) => setResearchPrompt(e.target.value)}
                    placeholder="Ex.: Por que este lugar na África se parece com Marte? Que rochas existem aqui?"
                    className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] placeholder:text-[#94A3B8] dark:placeholder:text-[#6E7681] text-sm p-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] dark:focus-visible:ring-[#60A5FA]"
                  />
                </div>

                {chatError && (
                  <div role="alert" className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl text-xs text-[#B91C1C] dark:text-[#FCA5A5] flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.75} aria-hidden="true" />
                    <span>{chatError}</span>
                  </div>
                )}

                {chatHistory.length > 0 && (
                  <div aria-live="polite" className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {chatHistory.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans ${
                          msg.role === 'user'
                            ? 'bg-[#F1F5F9] dark:bg-[#21262D] text-[#0F172A] dark:text-[#F0F6FC]'
                            : 'bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#E2E8F0]'
                        }`}
                      >
                        <div className="text-[11px] font-semibold text-[#1E3A8A] dark:text-[#60A5FA] mb-1">
                          {msg.role === 'user' ? 'Você' : 'Copiloto IA (Apoio à Análise)'}
                          {msg.attachmentName ? ` · ${msg.attachmentName}` : ''}
                        </div>
                        {msg.content}
                        {msg.reasoning && (
                          <details className="mt-2 pt-1.5 text-[11px] text-[#475569] dark:text-[#94A3B8]">
                            <summary className="cursor-pointer font-medium hover:text-[#0F172A] dark:hover:text-[#F0F6FC] select-none">
                              Ver raciocínio da IA
                            </summary>
                            <div className="mt-1 whitespace-pre-wrap opacity-90">{msg.reasoning}</div>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isChatLoading}
                className="w-full min-h-[42px] py-2 px-4 bg-[#1E3A8A] dark:bg-[#2563EB] hover:bg-[#1E40AF] dark:hover:bg-[#1D4ED8] disabled:opacity-50 text-[#FFFFFF] text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {isChatLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
                    <span>Analisando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                    <span>{chatHistory.length > 0 ? 'Enviar Nova Pergunta' : 'Perguntar e Analisar'}</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* MODE B: UNIFIED STRUCTURED DATA ENTRY */}
          {inputMode === 'data_form' && (
            <form onSubmit={handleSaveDataForm} className="space-y-3.5 flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                <div>
                  <label htmlFor="u-sample-name" className="text-xs font-medium text-[#475569] dark:text-[#94A3B8] block mb-1">
                    Nome do Lugar ou Amostra
                  </label>
                  <input
                    id="u-sample-name"
                    type="text"
                    value={sampleName}
                    onChange={(e) => setSampleName(e.target.value)}
                    placeholder="Ex.: Solo Salino de Danakil"
                    className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-xs px-3 py-2.5 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label htmlFor="u-collector" className="text-xs font-medium text-[#475569] dark:text-[#94A3B8] block mb-1">
                      Seu Nome ou Equipe
                    </label>
                    <input
                      id="u-collector"
                      type="text"
                      value={collectorName}
                      onChange={(e) => setCollectorName(e.target.value)}
                      className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-xs px-3 py-2.5 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
                    />
                  </div>
                  <div>
                    <label htmlFor="u-site" className="text-xs font-medium text-[#475569] dark:text-[#94A3B8] block mb-1">
                      Lugar da Coleta (escreva manualmente) *
                    </label>
                    <input
                      id="u-site"
                      type="text"
                      required
                      list="u-site-suggestions"
                      value={customLocation}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomLocation(val);
                        const found = sites.find((s) => s.name.toLowerCase() === val.trim().toLowerCase());
                        if (found) {
                          setSiteId(found.id);
                          onSelectSite(found);
                        }
                      }}
                      placeholder="Ex.: Deserto do Namibe, Angola"
                      className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-xs px-3 py-2.5 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
                    />
                    <datalist id="u-site-suggestions">
                      {sites.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.country} · {s.targetPlanet}
                        </option>
                      ))}
                    </datalist>
                  </div>
                </div>

                <div>
                  <label htmlFor="u-notes" className="text-xs font-medium text-[#475569] dark:text-[#94A3B8] block mb-1">
                    O que você observou?
                  </label>
                  <textarea
                    id="u-notes"
                    rows={2}
                    value={fieldNotes}
                    onChange={(e) => setFieldNotes(e.target.value)}
                    placeholder="Ex.: Solo muito seco e avermelhado, com cristais brancos..."
                    className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-xs p-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
                  />
                </div>

                <div className="bg-[#F8FAFC] dark:bg-[#0D1117] rounded-xl p-3 space-y-3">
                  <div className="text-xs font-semibold text-[#1E3A8A] dark:text-[#60A5FA]">
                    Medidas Manuais de Solo &amp; Minerais
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label htmlFor="u-minerals-text" className="text-xs font-medium text-[#475569] dark:text-[#94A3B8] block mb-1">
                        Minerais observados (ex: Basalto: 45, Óxido de Ferro: 35, Areia: 20)
                      </label>
                      <input
                        id="u-minerals-text"
                        type="text"
                        value={mineralsManualText}
                        onChange={(e) => {
                          setMineralsManualText(e.target.value);
                          setMinerals(parseManualMineralsInput(e.target.value));
                        }}
                        placeholder="Ex.: Basalto: 50, Óxido de Ferro: 30, Quartzo: 20"
                        className="w-full bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#F0F6FC] text-xs px-3 py-2 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <label htmlFor="u-source" className="text-xs font-medium text-[#475569] dark:text-[#94A3B8]">
                          Origem dos Dados
                        </label>
                        <button
                          type="button"
                          onClick={() => openNasaShortcuts('datasets')}
                          className="text-[11px] font-medium text-[#1E3A8A] dark:text-[#60A5FA] hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Satellite className="w-3 h-3" strokeWidth={1.75} aria-hidden="true" />
                          <span>Não tem dados? Achar fontes NASA</span>
                        </button>
                      </div>
                      <input
                        id="u-source"
                        type="text"
                        value={officialSource}
                        onChange={(e) => setOfficialSource(e.target.value)}
                        className="w-full bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#F0F6FC] text-xs px-3 py-2 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label htmlFor="u-aw" className="text-xs font-medium text-[#475569] dark:text-[#94A3B8] block mb-1">
                          Umidade (0–1)
                        </label>
                        <input
                          id="u-aw"
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={waterActivity}
                          onChange={(e) => setWaterActivity(parseFloat(e.target.value) || 0)}
                          className="w-full bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#F0F6FC] font-mono text-xs px-2.5 py-2 rounded-xl tabular-nums"
                        />
                      </div>
                      <div>
                        <label htmlFor="u-ph" className="text-xs font-medium text-[#475569] dark:text-[#94A3B8] block mb-1">
                          Acidez (pH)
                        </label>
                        <input
                          id="u-ph"
                          type="number"
                          step="0.1"
                          min="0"
                          max="14"
                          value={pH}
                          onChange={(e) => setPH(parseFloat(e.target.value) || 7)}
                          className="w-full bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#F0F6FC] font-mono text-xs px-2.5 py-2 rounded-xl tabular-nums"
                        />
                      </div>
                      <div>
                        <label htmlFor="u-depth" className="text-xs font-medium text-[#475569] dark:text-[#94A3B8] block mb-1">
                          Profund. (cm)
                        </label>
                        <input
                          id="u-depth"
                          type="number"
                          step="0.5"
                          value={depthCm}
                          onChange={(e) => setDepthCm(parseFloat(e.target.value) || 0)}
                          className="w-full bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#F0F6FC] font-mono text-xs px-2.5 py-2 rounded-xl tabular-nums"
                        />
                      </div>
                      <div>
                        <label htmlFor="u-porosity" className="text-xs font-medium text-[#475569] dark:text-[#94A3B8] block mb-1">
                          Porosid. (%)
                        </label>
                        <input
                          id="u-porosity"
                          type="number"
                          step="0.5"
                          value={porosityPercent}
                          onChange={(e) => setPorosityPercent(parseFloat(e.target.value) || 0)}
                          className="w-full bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#F0F6FC] font-mono text-xs px-2.5 py-2 rounded-xl tabular-nums"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="submit"
                  className="flex-1 min-h-[42px] py-2 px-4 bg-[#1E3A8A] dark:bg-[#2563EB] hover:bg-[#1E40AF] dark:hover:bg-[#1D4ED8] text-[#FFFFFF] text-sm font-medium rounded-xl transition-colors cursor-pointer"
                >
                  Salvar Dados Manuais no Painel
                </button>
                {onOpenPublishFromAi && (
                  <button
                    type="button"
                    onClick={onOpenPublishFromAi}
                    className="min-h-[42px] py-2 px-4 bg-[#0F766E] dark:bg-[#0D9488] hover:bg-[#0D9488] text-[#FFFFFF] text-xs font-medium rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span>Publicar Artigo</span>
                  </button>
                )}
              </div>
            </form>
          )}

          {/* MODE C: COMPUTER VISION + REAL-TIME CAMERA + TIFF/GEOTIFF & ENCRYPTED DATASETS */}
          {inputMode === 'vision' && (
            <div className="space-y-3.5 flex-1 flex flex-col justify-between">
              <div className="space-y-3.5">
                {/* Camera vs Upload Controls */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={isCameraOpen ? stopCameraStream : handleOpenCamera}
                    className={`min-h-[38px] py-2 px-3 text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      isCameraOpen
                        ? 'bg-red-50 dark:bg-red-950/40 text-[#B91C1C] dark:text-[#FCA5A5]'
                        : 'bg-[#F1F5F9] dark:bg-[#0D1117] hover:bg-[#E2E8F0] dark:hover:bg-[#21262D] text-[#0F172A] dark:text-[#F0F6FC]'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    <span>{isCameraOpen ? 'Fechar Câmera' : 'Câmera ao Vivo'}</span>
                  </button>

                  <label className="min-h-[38px] py-2 px-3 bg-[#F1F5F9] dark:bg-[#0D1117] hover:bg-[#E2E8F0] dark:hover:bg-[#21262D] text-[#0F172A] dark:text-[#F0F6FC] text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
                    <Upload className="w-3.5 h-3.5 shrink-0 text-[#1E3A8A] dark:text-[#60A5FA]" strokeWidth={1.75} aria-hidden="true" />
                    <span>Enviar Foto ou Arquivo</span>
                    <input
                      type="file"
                      accept="image/*,.tif,.tiff,.geotiff,.enc,.aes,.bin,.dat,.pgp,.asc,.b64,.crypt,.json"
                      onChange={handleImageUpload}
                      className="sr-only"
                    />
                  </label>
                </div>

                {/* Inline Decryption Panel (shown automatically when an encrypted file is uploaded or toggled) */}
                {(showDecryptPanel || pendingEncryptedFile) && (
                  <div className="p-3.5 rounded-2xl bg-[#F8FAFC] dark:bg-[#0D1117] space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0F172A] dark:text-[#F0F6FC]">
                        <Lock className="w-3.5 h-3.5 text-[#1E3A8A] dark:text-[#60A5FA]" strokeWidth={1.75} aria-hidden="true" />
                        <span>Arquivo protegido por senha</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDecryptPanel(false);
                          setPendingEncryptedFile(null);
                          setDecryptError(null);
                        }}
                        aria-label="Fechar painel de senha"
                        className="p-1 text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F0F6FC] rounded-lg cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" strokeWidth={1.75} />
                      </button>
                    </div>

                    {pendingEncryptedFile && (
                      <div className="text-[11px] text-[#475569] dark:text-[#94A3B8] bg-[#FFFFFF] dark:bg-[#161B22] px-2.5 py-1.5 rounded-xl truncate">
                        Arquivo: {pendingEncryptedFile.name} ({Math.max(1, Math.round(pendingEncryptedFile.size / 1024))} KB)
                      </div>
                    )}

                    <div className="relative">
                      <label htmlFor="decrypt-secret" className="sr-only">
                        Senha ou chave para abrir a imagem
                      </label>
                      <input
                        id="decrypt-secret"
                        type={showDecryptKey ? 'text' : 'password'}
                        value={decryptKey}
                        onChange={(e) => setDecryptKey(e.target.value)}
                        placeholder="Digite a senha para abrir o arquivo..."
                        className="w-full bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#F0F6FC] text-xs pl-3 pr-9 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowDecryptKey((prev) => !prev)}
                        aria-label={showDecryptKey ? 'Ocultar senha' : 'Mostrar senha'}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F0F6FC] cursor-pointer"
                      >
                        {showDecryptKey ? (
                          <EyeOff className="w-3.5 h-3.5" strokeWidth={1.75} />
                        ) : (
                          <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />
                        )}
                      </button>
                    </div>

                    <details className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                      <summary className="cursor-pointer hover:text-[#0F172A] dark:hover:text-[#F0F6FC] select-none">
                        Opções avançadas de formato
                      </summary>
                      <div className="pt-2">
                        <label htmlFor="decrypt-alg" className="sr-only">
                          Formato de proteção do arquivo
                        </label>
                        <select
                          id="decrypt-alg"
                          value={decryptAlgorithm}
                          onChange={(e) => setDecryptAlgorithm(e.target.value as DecryptionAlgorithm)}
                          className="w-full bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#F0F6FC] text-xs px-2.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                        >
                          <option value="auto">Detectar automaticamente (recomendado)</option>
                          <option value="aes_gcm_pbkdf2">AES-256-GCM (PBKDF2)</option>
                          <option value="openssl_aes_cbc">OpenSSL AES-256-CBC</option>
                          <option value="raw_key_aes_gcm">Chave Hex/Base64 (GCM)</option>
                          <option value="raw_key_aes_cbc">Chave Hex/Base64 (CBC)</option>
                        </select>
                      </div>
                    </details>

                    {decryptError && (
                      <div role="alert" className="p-2.5 bg-red-50 dark:bg-red-950/40 rounded-xl text-[11px] text-[#B91C1C] dark:text-[#FCA5A5] flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={1.75} aria-hidden="true" />
                        <span>{decryptError}</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleDecryptPendingFile}
                      disabled={isDecrypting}
                      className="w-full min-h-[38px] py-2 px-3 bg-[#1E3A8A] dark:bg-[#2563EB] hover:bg-[#1E40AF] dark:hover:bg-[#1D4ED8] disabled:opacity-50 text-[#FFFFFF] text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {isDecrypting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} aria-hidden="true" />
                          <span>Abrindo imagem...</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                          <span>Desbloquear e Abrir Imagem</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {cameraError && (
                  <div role="alert" className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-xs text-[#B45309] dark:text-[#FBBF24] flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.75} aria-hidden="true" />
                    <span>{cameraError}</span>
                  </div>
                )}

                {isCameraOpen ? (
                  <div className="space-y-2.5">
                    <div className="relative h-52 rounded-xl overflow-hidden bg-[#0D1117]">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        aria-label="Visualização ao vivo da câmera"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-lg bg-[#0F172A]/80 text-[#FFFFFF] text-[10px] font-medium">
                        AO VIVO
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleCaptureCameraFrame(false)}
                        className="min-h-[38px] py-2 px-3 bg-[#F1F5F9] dark:bg-[#21262D] hover:bg-[#E2E8F0] dark:hover:bg-[#30363D] text-[#0F172A] dark:text-[#F0F6FC] text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                        <span>Tirar Foto</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCaptureCameraFrame(true)}
                        disabled={isAnalyzingVision}
                        className="min-h-[38px] py-2 px-3 bg-[#1E3A8A] dark:bg-[#2563EB] hover:bg-[#1E40AF] dark:hover:bg-[#1D4ED8] text-[#FFFFFF] text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Cpu className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                        <span>Tirar e Analisar</span>
                      </button>
                    </div>
                  </div>
                ) : uploadedImage ? (
                  <div className="space-y-2.5">
                    <div className="relative h-44 rounded-xl overflow-hidden bg-[#F1F5F9] dark:bg-[#0D1117]">
                      <img
                        src={uploadedImage}
                        alt={uploadedFileName || 'Foto ou imagem carregada'}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#475569] dark:text-[#94A3B8]">
                      <span className="truncate max-w-[180px]">{uploadedFileName}</span>
                      <div className="flex items-center gap-3">
                        <a
                          href={uploadedImage}
                          download={`${(uploadedFileName || 'imagem').replace(/\.[^/.]+$/, '')}.png`}
                          className="inline-flex items-center gap-1 text-[#0F766E] dark:text-[#2DD4BF] font-medium hover:underline"
                        >
                          <Download className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                          <span>Baixar PNG</span>
                        </a>
                        <button
                          type="button"
                          onClick={handleOpenCamera}
                          className="text-[#1E3A8A] dark:text-[#60A5FA] font-medium hover:underline cursor-pointer"
                        >
                          Nova foto
                        </button>
                      </div>
                    </div>

                    {rasterMetadata && (
                      <details className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117] text-[11px]">
                        <summary className="cursor-pointer font-medium text-[#0F172A] dark:text-[#F0F6FC] flex items-center gap-1.5 select-none">
                          <FileCode2 className="w-3.5 h-3.5 text-[#1E3A8A] dark:text-[#60A5FA]" strokeWidth={1.75} aria-hidden="true" />
                          <span>Detalhes técnicos da imagem ({rasterMetadata.detectedFormat})</span>
                        </summary>
                        <div className="pt-2 space-y-1.5">
                          {rasterMetadata.wasEncrypted && (
                            <span className="inline-block px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-[#15803D] dark:text-[#4ADE80] font-medium">
                              Arquivo desbloqueado ({rasterMetadata.decryptionMethod})
                            </span>
                          )}
                          <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[#475569] dark:text-[#94A3B8] tabular-nums">
                            {rasterMetadata.width && rasterMetadata.height && (
                              <span>
                                {rasterMetadata.width}×{rasterMetadata.height} px
                              </span>
                            )}
                            {rasterMetadata.bands && (
                              <span>
                                {rasterMetadata.bands} camada(s) / {rasterMetadata.bitsPerSample || 8}-bit
                              </span>
                            )}
                            {rasterMetadata.geoCoords && (
                              <span className="text-[#0F766E] dark:text-[#2DD4BF]">
                                Mapa: {rasterMetadata.geoCoords.lat.toFixed(4)}°, {rasterMetadata.geoCoords.lng.toFixed(4)}°
                              </span>
                            )}
                          </div>
                        </div>
                      </details>
                    )}
                    {visualTelemetry && (
                      <div className="p-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117] text-[11px] text-[#475569] dark:text-[#94A3B8] space-y-1">
                        <div className="font-medium text-[#0F172A] dark:text-[#F0F6FC]">
                          Cor predominante medida: {visualTelemetry.dominantColorTag}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono tabular-nums">
                          <span>Brilho/Albedo: {Math.round(visualTelemetry.brightnessAlbedo * 100)}%</span>
                          <span>Índice Ferro: {visualTelemetry.ironOxideIndex}</span>
                          <span>Textura/Contraste: {visualTelemetry.surfaceContrast}</span>
                        </div>
                      </div>
                    )}

                    <div>
                      <label htmlFor="vision-notes" className="sr-only">
                        Observação rápida sobre a foto
                      </label>
                      <input
                        id="vision-notes"
                        type="text"
                        value={visualNotes}
                        onChange={(e) => setVisualNotes(e.target.value)}
                        placeholder="Opcional: descreva o que vê na foto (ex.: rocha porosa vermelha)..."
                        className="w-full bg-[#F8FAFC] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] placeholder:text-[#94A3B8] text-xs px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                      />
                    </div>
                  </div>
                ) : !showDecryptPanel ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleOpenCamera}
                      className="w-full min-h-[168px] rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117] hover:bg-[#F1F5F9] dark:hover:bg-[#21262D] transition-colors p-6 flex flex-col items-center justify-center text-center cursor-pointer"
                    >
                      <Camera className="w-6 h-6 text-[#1E3A8A] dark:text-[#60A5FA] mb-2" strokeWidth={1.75} aria-hidden="true" />
                      <span className="text-sm font-medium text-[#0F172A] dark:text-[#F0F6FC]">
                        Abrir Câmera ou Enviar Foto
                      </span>
                      <span className="text-xs text-[#475569] dark:text-[#94A3B8] mt-1">
                        Tire foto de uma pedra, solo ou envie fotos e imagens de satélite (incluindo arquivos TIFF ou protegidos por senha).
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openNasaShortcuts('imagery')}
                      className="text-[11px] font-medium text-[#1E3A8A] dark:text-[#60A5FA] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Satellite className="w-3 h-3" strokeWidth={1.75} aria-hidden="true" />
                      <span>Sem foto ou mapa GeoTIFF? Ver fontes de imagens da NASA</span>
                    </button>
                  </div>
                ) : null}

                {visionError && (
                  <div role="alert" className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl text-xs text-[#B91C1C] dark:text-[#FCA5A5] flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.75} aria-hidden="true" />
                    <span>{visionError}</span>
                  </div>
                )}

                {visionResult && (
                  <div aria-live="polite" className="p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117] space-y-2 text-xs">
                    <div className="text-[11px] font-semibold text-[#1E3A8A] dark:text-[#60A5FA]">
                      Parecer do Copiloto Visual IA (não altera seus dados manuais)
                    </div>
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-[#15803D] dark:text-[#4ADE80]">
                        Sugestão de local parecido: {visionResult.closestAnalogue || 'não indicada pelo modelo'}
                      </span>
                      <span className="font-mono text-[#1E3A8A] dark:text-[#60A5FA] tabular-nums">
                        {typeof visionResult.fidelityScore === 'number' ? `${visionResult.fidelityScore}%` : '—'}
                      </span>
                    </div>
                    {visionResult.parsedOk === false && (
                      <div className="text-[#B45309] dark:text-[#FBBF24]">
                        O modelo não respondeu no formato esperado; veja o texto completo abaixo.
                      </div>
                    )}
                    {visionResult.features?.length > 0 && (
                      <div className="text-[#475569] dark:text-[#94A3B8]">
                        O que aparece: {visionResult.features.join(' · ')}
                      </div>
                    )}
                    {visionResult.minerals?.length > 0 && (
                      <div className="text-[#475569] dark:text-[#94A3B8]">
                        Minerais sugeridos para conferir: {visionResult.minerals.join(' · ')}
                      </div>
                    )}
                    <div className="text-[11px] text-[#64748B] dark:text-[#8B949E]">
                      Base da análise: cores e brilho medidos na foto, metadados e as suas notas. O modelo de IA não vê a imagem.
                    </div>
                    {visionResult.diagnosis && (
                      <p className="text-[#0F172A] dark:text-[#E2E8F0] leading-relaxed">
                        {visionResult.diagnosis}
                      </p>
                    )}
                    {visionResult.minerals?.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const suggested = visionResult.minerals
                            .slice(0, 4)
                            .map((m: string, idx: number, arr: string[]) => `${m}: ${Math.round(100 / arr.length)}`)
                            .join(', ');
                          setMineralsManualText(suggested);
                          setMinerals(parseManualMineralsInput(suggested));
                          setInputMode('data_form');
                        }}
                        className="py-1.5 px-3 rounded-lg bg-[#FFFFFF] dark:bg-[#161B22] text-[#1E3A8A] dark:text-[#60A5FA] font-medium shadow-xs cursor-pointer"
                      >
                        Usar minerais sugeridos no meu formulário manual
                      </button>
                    )}
                    {visionResult.reasoning && (
                      <details className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                        <summary className="cursor-pointer font-medium select-none">Ver raciocínio da IA</summary>
                        <div className="mt-1 whitespace-pre-wrap">{visionResult.reasoning}</div>
                      </details>
                    )}
                  </div>
                )}
              </div>

              {!isCameraOpen && !pendingEncryptedFile && (
                <button
                  type="button"
                  onClick={() => handleRunVisionAnalysis()}
                  disabled={isAnalyzingVision || isDecrypting}
                  className="w-full min-h-[42px] py-2 px-4 bg-[#1E3A8A] dark:bg-[#2563EB] hover:bg-[#1E40AF] dark:hover:bg-[#1D4ED8] disabled:opacity-50 text-[#FFFFFF] text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isAnalyzingVision ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
                      <span>Analisando foto...</span>
                    </>
                  ) : (
                    <>
                      <Cpu className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                      <span>Analisar Foto com IA</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </section>

        {/* RIGHT BOWL (7 cols): Interactive Map & Selected Site Overview */}
        <section
          aria-label="Mapa de lugares no mundo"
          className="lg:col-span-7 bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-4 transition-colors duration-150"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-poppins text-base font-bold text-[#0F172A] dark:text-[#F0F6FC] flex items-center gap-2">
                <Mountain className="w-4 h-4 text-[#1E3A8A] dark:text-[#60A5FA]" strokeWidth={1.75} aria-hidden="true" />
                <span>Mapa de Análogos</span>
              </h2>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-0.5 tabular-nums">
                {filteredSites.length} de {sites.length} lugares · clique no mapa para analisar qualquer ponto
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-pressed={showNasaEvents}
                onClick={handleToggleNasaEvents}
                className={`py-2 px-3 text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer ${
                  showNasaEvents
                    ? 'bg-[#D97706] text-[#FFFFFF]'
                    : 'bg-[#F1F5F9] dark:bg-[#0D1117] text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F0F6FC]'
                }`}
              >
                <Flame className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                <span>{nasaEventsLoading ? 'Carregando NASA...' : 'Eventos NASA'}</span>
              </button>

              <select
                aria-label="Filtrar lugares no mapa"
                value={filterRegionOrPlanet}
                onChange={(e) => setFilterRegionOrPlanet(e.target.value)}
                className="bg-[#F1F5F9] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] text-xs font-medium px-3 py-2 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
              >
                <option value="ALL">Todos os lugares ({sites.length})</option>
                <option value="AFRICA">Na África ({sites.filter((s) => s.region === 'África').length})</option>
                <optgroup label="Planetas">
                  {PLANET_BODIES.map((b) => (
                    <option key={b.id} value={b.id}>
                      Parecidos com {b.namePt}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Planetas Anões">
                  {DWARF_PLANET_BODIES.map((b) => (
                    <option key={b.id} value={b.id}>
                      Parecidos com {b.namePt}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Satélites Naturais (Luas)">
                  {SATELLITE_BODIES.map((b) => (
                    <option key={b.id} value={b.id}>
                      Parecidos com {b.namePt} ({b.hostBodyPt})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          <InteractiveSiteMap
            ref={mapRef}
            sites={filteredSites}
            allSites={sites}
            selectedSite={selectedSite}
            onSelectSite={handleMapSelectSite}
            showNasaEvents={showNasaEvents}
            nasaEvents={nasaEvents}
            userLocation={currentCoords ? { ...currentCoords, accuracy: gpsAccuracy } : null}
            onUsePoint={handleUseMapPoint}
          />

          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
              <div>
                <div className="text-xs text-[#475569] dark:text-[#94A3B8]">
                  {selectedSite.country} ({selectedSite.region}) · Parecido com {selectedSite.targetPlanet}
                </div>
                <h3 className="font-poppins text-base sm:text-lg font-bold text-[#0F172A] dark:text-[#F0F6FC] mt-0.5">
                  {selectedSite.name}
                </h3>
              </div>

              <div className="text-right shrink-0 bg-[#F1F5F9] dark:bg-[#21262D] px-3 py-1.5 rounded-xl">
                <div className="text-[11px] text-[#475569] dark:text-[#94A3B8]" title="Estimativa editorial, não medida">
                  Semelhança (estimativa)
                </div>
                <div className="text-lg font-bold font-mono text-[#1E3A8A] dark:text-[#60A5FA] tabular-nums">
                  {selectedSite.fidelityScore}%
                </div>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#475569] dark:text-[#94A3B8] leading-relaxed line-clamp-2">
              {selectedSite.description}
            </p>

            {/* 4 Bento Sub-cells inside Map Compartment */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-3 bg-[#F8FAFC] dark:bg-[#0D1117] rounded-xl">
                <span className="text-[#475569] dark:text-[#94A3B8] block">Altura</span>
                <span className="font-mono font-semibold text-[#0F172A] dark:text-[#F0F6FC] tabular-nums mt-0.5 block">
                  {selectedSite.elevationMeters} m
                </span>
              </div>
              <div className="p-3 bg-[#F8FAFC] dark:bg-[#0D1117] rounded-xl">
                <span className="text-[#475569] dark:text-[#94A3B8] block">Umidade do Solo</span>
                <span className="font-semibold text-[#0F172A] dark:text-[#F0F6FC] tabular-nums mt-0.5 block">
                  {Math.round(selectedSite.waterActivityAw * 100)}% ({selectedSite.waterActivityAw < 0.35 ? 'Muito seco' : 'Moderado'})
                </span>
              </div>
              <div className="p-3 bg-[#F8FAFC] dark:bg-[#0D1117] rounded-xl">
                <span className="text-[#475569] dark:text-[#94A3B8] block">Região</span>
                <span className="font-semibold text-[#0F172A] dark:text-[#F0F6FC] truncate block mt-0.5">
                  {selectedSite.country}
                </span>
              </div>
              <div className="p-3 bg-[#F8FAFC] dark:bg-[#0D1117] rounded-xl">
                <span className="text-[#475569] dark:text-[#94A3B8] block">Referência</span>
                {selectedSite.references[0] ? (
                  <a
                    href={selectedSite.references[0].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={selectedSite.references[0].citation}
                    className="font-medium text-[#1E3A8A] dark:text-[#60A5FA] underline underline-offset-2 truncate block mt-0.5"
                  >
                    {selectedSite.references[0].citation.split('(')[0].trim()}
                  </a>
                ) : (
                  <span className="font-medium text-[#0F172A] dark:text-[#F0F6FC] truncate block mt-0.5">—</span>
                )}
              </div>
            </div>

            {selectedSite.references.length > 0 && (
              <details className="text-xs text-[#475569] dark:text-[#94A3B8]">
                <summary className="cursor-pointer select-none">
                  Referências científicas ({selectedSite.references.length})
                </summary>
                <ul className="mt-1.5 space-y-1">
                  {selectedSite.references.map((ref) => (
                    <li key={ref.url}>
                      <a href={ref.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {ref.citation}
                        {ref.doi ? <span className="font-mono"> doi:{ref.doi}</span> : null}
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[11px]">
                  A "semelhança" de cada sítio é uma estimativa editorial; a da sua amostra é calculada a partir dos dados que inseriu.
                </p>
              </details>
            )}
          </div>
        </section>
      </div>

      {/* BENTO ROW 2: DASHBOARD COMPARATIVO (INDICATORS, RADAR, SPECTRAL, PROS & CONS, SIMILARITIES) */}
      <AnalogueDashboard
        sites={sites}
        selectedSite={selectedSite}
        activeSample={activeSample}
        latestAiAnalysis={latestAiAnalysis}
        onUpdateSample={onSaveSample}
        onSelectSite={(site) => {
          onSelectSite(site);
          mapRef.current?.flyTo(site.coordinates, 6);
        }}
      />

      {/* BENTO ROW 3: QUICK AI ANALYSIS BOWL (5 cols) + SUMMARY & CONCLUSION BOWL (7 cols) */}
      <section ref={reportSectionRef} aria-labelledby="diagnostics-report-heading" className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Bowl: AI Quick Analyses (5 cols) */}
        <div className="lg:col-span-5 bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-4 transition-colors duration-150">
          <div className="flex items-center justify-between">
            <h2 id="diagnostics-report-heading" className="font-poppins text-base font-bold text-[#0F172A] dark:text-[#F0F6FC] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#1E3A8A] dark:text-[#60A5FA]" strokeWidth={1.75} aria-hidden="true" />
              <span>Copiloto: Análise Rápida</span>
            </h2>
            <span className="text-xs font-medium text-[#1E3A8A] dark:text-[#60A5FA] bg-[#F1F5F9] dark:bg-[#21262D] px-2.5 py-1 rounded-lg">
              {activeSample.targetPlanet}
            </span>
          </div>

          <div className="space-y-2.5">
            {pathways
              .filter((item) => item.primary)
              .map((item) => {
                const isSelected = selectedPathway === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedPathway(item.id)}
                    className={`w-full text-left p-3.5 rounded-xl transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#F1F5F9] dark:bg-[#21262D]'
                        : 'bg-[#F8FAFC] dark:bg-[#0D1117] hover:bg-[#F1F5F9] dark:hover:bg-[#1C2128]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className={isSelected ? 'text-[#1E3A8A] dark:text-[#60A5FA] font-semibold' : 'text-[#475569] dark:text-[#94A3B8]'}>
                        {item.category}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#1E3A8A] dark:text-[#60A5FA]" strokeWidth={2} />}
                    </div>
                    <div className="text-sm font-semibold text-[#0F172A] dark:text-[#F0F6FC] mt-0.5">{item.title}</div>
                    <div className="text-xs text-[#475569] dark:text-[#94A3B8] mt-0.5 leading-relaxed">{item.description}</div>
                  </button>
                );
              })}

            <details className="rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117] p-3">
              <summary className="text-xs font-medium text-[#1E3A8A] dark:text-[#60A5FA] cursor-pointer select-none">
                Mais análises especializadas (outras luas e planetas)
              </summary>
              <div className="space-y-2 pt-2.5">
                {pathways
                  .filter((item) => !item.primary)
                  .map((item) => {
                    const isSelected = selectedPathway === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setSelectedPathway(item.id)}
                        className={`w-full text-left p-3 rounded-xl transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#FFFFFF] dark:bg-[#21262D] shadow-xs'
                            : 'bg-[#FFFFFF]/60 dark:bg-[#161B22] hover:bg-[#FFFFFF] dark:hover:bg-[#1C2128]'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span className={isSelected ? 'text-[#1E3A8A] dark:text-[#60A5FA] font-semibold' : 'text-[#475569] dark:text-[#94A3B8]'}>
                            {item.category}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#1E3A8A] dark:text-[#60A5FA]" strokeWidth={2} />}
                        </div>
                        <div className="text-sm font-semibold text-[#0F172A] dark:text-[#F0F6FC] mt-0.5">{item.title}</div>
                        <div className="text-xs text-[#475569] dark:text-[#94A3B8] mt-0.5">{item.description}</div>
                      </button>
                    );
                  })}
              </div>
            </details>
          </div>

          <div className="space-y-3">
            {diagError && (
              <div role="alert" className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl text-xs text-[#B91C1C] dark:text-[#FCA5A5]">
                {diagError}
              </div>
            )}

            <button
              type="button"
              onClick={handleRunDiagnostic}
              disabled={isDiagLoading}
              className="w-full min-h-[42px] py-2 px-4 bg-[#1E3A8A] dark:bg-[#2563EB] hover:bg-[#1E40AF] dark:hover:bg-[#1D4ED8] disabled:opacity-50 text-[#FFFFFF] text-sm font-medium rounded-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              {isDiagLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
                  <span>Analisando...</span>
                </>
              ) : (
                <>
                  <Cpu className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                  <span>Analisar Agora</span>
                </>
              )}
            </button>

            {diagnosticResult && (
              <div aria-live="polite" className="p-4 bg-[#F8FAFC] dark:bg-[#0D1117] rounded-xl text-xs sm:text-sm font-sans text-[#0F172A] dark:text-[#E2E8F0] whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto space-y-2">
                <div>{diagnosticResult}</div>
                {diagReasoning && (
                  <details className="text-[11px] text-[#475569] dark:text-[#94A3B8] pt-1">
                    <summary className="cursor-pointer font-medium select-none">Ver raciocínio da IA</summary>
                    <div className="mt-1 whitespace-pre-wrap">{diagReasoning}</div>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Bowl: Friendly Summary & Conclusion Report (7 cols) */}
        <div className="lg:col-span-7 bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-5 transition-colors duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs text-[#475569] dark:text-[#94A3B8]">
                Atualizado em {documentDate}
              </div>
              <h2 className="font-poppins text-base sm:text-lg font-bold text-[#0F172A] dark:text-[#F0F6FC]">
                Resumo &amp; Conclusão da Pesquisa
              </h2>
            </div>

            <button
              type="button"
              onClick={handleGenerateReport}
              disabled={isGeneratingReport}
              className="min-h-[40px] py-2 px-4 bg-[#1E3A8A] dark:bg-[#2563EB] hover:bg-[#1E40AF] dark:hover:bg-[#1D4ED8] disabled:opacity-50 text-[#FFFFFF] text-xs font-medium rounded-xl flex items-center gap-2 cursor-pointer shrink-0"
            >
              {isGeneratingReport ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
                  <span>Escrevendo...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                  <span>{reportText ? 'Atualizar Resumo' : 'Criar Resumo Completo'}</span>
                </>
              )}
            </button>
          </div>

          {reportError && (
            <div role="alert" className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl text-xs text-[#B91C1C] dark:text-[#FCA5A5]">
              {reportError}
            </div>
          )}

          {reportText ? (
            <div aria-live="polite" className="space-y-4 flex-1 flex flex-col justify-between">
              <div className="p-5 bg-[#F8FAFC] dark:bg-[#0D1117] rounded-xl text-xs sm:text-sm font-sans text-[#0F172A] dark:text-[#E2E8F0] leading-relaxed whitespace-pre-wrap max-h-[380px] overflow-y-auto flex-1">
                {reportText}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-[#475569] dark:text-[#94A3B8] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#15803D] dark:text-[#4ADE80]" strokeWidth={1.75} aria-hidden="true" />
                  <span>Baseado em {activeSample.officialSource}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyReport}
                    className="min-h-[38px] flex items-center gap-1.5 py-1.5 px-3 bg-[#F1F5F9] dark:bg-[#21262D] hover:bg-[#E2E8F0] dark:hover:bg-[#30363D] text-[#0F172A] dark:text-[#F0F6FC] text-xs font-medium rounded-xl cursor-pointer"
                  >
                    {copiedReport ? <Check className="w-3.5 h-3.5 text-[#15803D]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedReport ? 'Copiado' : 'Copiar'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadMarkdown}
                    className="min-h-[38px] flex items-center gap-1.5 py-1.5 px-3 bg-[#F1F5F9] dark:bg-[#21262D] hover:bg-[#E2E8F0] dark:hover:bg-[#30363D] text-[#0F172A] dark:text-[#F0F6FC] text-xs font-medium rounded-xl cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="min-h-[38px] flex items-center gap-1.5 py-1.5 px-3 bg-[#F1F5F9] dark:bg-[#21262D] hover:bg-[#E2E8F0] dark:hover:bg-[#30363D] text-[#0F172A] dark:text-[#F0F6FC] text-xs font-medium rounded-xl cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>

                  {onOpenPublishFromAi && (
                    <button
                      type="button"
                      onClick={onOpenPublishFromAi}
                      className="min-h-[38px] flex items-center gap-1.5 py-1.5 px-3.5 bg-[#0F766E] dark:bg-[#0D9488] hover:bg-[#0D9488] text-[#FFFFFF] text-xs font-medium rounded-xl cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Publicar como Artigo</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 px-6 rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117] text-center space-y-3 flex-1 flex flex-col items-center justify-center">
              <ShieldCheck className="w-9 h-9 text-[#94A3B8] dark:text-[#6E7681]" strokeWidth={1.5} aria-hidden="true" />
              <div className="font-poppins text-sm font-semibold text-[#0F172A] dark:text-[#F0F6FC]">
                Seu resumo está pronto para ser criado
              </div>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8] max-w-md mx-auto leading-relaxed">
                Clique em "Criar Resumo Completo" para juntar tudo o que você pesquisou — suas perguntas, fotos e dados do mapa — em um texto fácil de ler e compartilhar.
              </p>
              {onOpenPublishFromAi && (chatHistory.length > 0 || diagnosticResult || visionResult || latestAiAnalysis) && (
                <button
                  type="button"
                  onClick={onOpenPublishFromAi}
                  className="min-h-[38px] inline-flex items-center gap-1.5 py-1.5 px-4 bg-[#0F766E] dark:bg-[#0D9488] text-[#FFFFFF] text-xs font-medium rounded-xl cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Publicar análise como Artigo</span>
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* BENTO ROW 4: OFFICIAL SITES CATALOGUE BOWL (Stroke-free) */}
      <section aria-labelledby="catalog-heading" className="bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-6 shadow-xs space-y-4 transition-colors duration-150">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="catalog-heading" className="font-poppins text-base font-bold text-[#0F172A] dark:text-[#F0F6FC]">
              Lugares Parecidos no Mundo ({filteredSites.length})
            </h2>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
              Clique em um lugar para abrir no mapa e comparar nos gráficos.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              aria-label="Buscar lugar ou mineral no catálogo"
              value={siteSearchQuery}
              onChange={(e) => setSiteSearchQuery(e.target.value)}
              placeholder="Buscar lugar, país ou mineral..."
              className="w-full bg-[#F1F5F9] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] placeholder:text-[#94A3B8] text-xs pl-8 pr-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117] p-2">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="text-xs font-medium text-[#475569] dark:text-[#94A3B8]">
                <th scope="col" className="py-3 px-4">Lugar</th>
                <th scope="col" className="py-3 px-4">País e Região</th>
                <th scope="col" className="py-3 px-4">Planeta Parecido</th>
                <th scope="col" className="py-3 px-4">O que tem lá</th>
                <th scope="col" className="py-3 px-4 text-right" title="Estimativa editorial, não medida">Semelhança (est.)</th>
              </tr>
            </thead>
            <tbody>
              {filteredSites.map((site) => {
                const isSelected = site.id === selectedSite.id;
                const handlePickSite = () => {
                  onSelectSite(site);
                  setTargetPlanet(site.targetPlanet);
                  setSiteId(site.id);
                  setCustomLocation(site.name);
                  mapRef.current?.flyTo(site.coordinates, 6);
                };
                return (
                  <tr
                    key={site.id}
                    tabIndex={0}
                    role="button"
                    aria-pressed={isSelected}
                    onClick={handlePickSite}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handlePickSite();
                      }
                    }}
                    className={`cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1E3A8A] dark:focus-visible:ring-[#60A5FA] ${
                      isSelected
                        ? 'bg-[#FFFFFF] dark:bg-[#21262D] shadow-xs'
                        : 'hover:bg-[#FFFFFF]/70 dark:hover:bg-[#161B22]'
                    }`}
                  >
                    <td className="py-3 px-4 font-medium text-[#0F172A] dark:text-[#F0F6FC] rounded-l-xl">
                      {site.name}
                    </td>
                    <td className="py-3 px-4 text-[#475569] dark:text-[#94A3B8] whitespace-nowrap">
                      {site.country} · {site.region}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#1E3A8A] dark:text-[#60A5FA] font-medium">
                      {site.targetPlanet}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#475569] dark:text-[#94A3B8] max-w-xs truncate">
                      {site.primaryMinerals.slice(0, 3).join(', ')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-[#0F172A] dark:text-[#F0F6FC] tabular-nums rounded-r-xl">
                      {site.fidelityScore}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <NasaDataShortcutsModal
        isOpen={showNasaModal}
        initialCategory={nasaModalFilter}
        selectedSite={selectedSite}
        currentCoords={currentCoords}
        targetPlanet={targetPlanet}
        onClose={() => setShowNasaModal(false)}
        onActivateNasaEventsOnMap={handleActivateNasaEventsOnMap}
      />
    </div>
  );
};

// Small helper to clear input value safely after reading
function handleDocumentUploadSafe(handler: (e: React.ChangeEvent<HTMLInputElement>) => void) {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    handler(e);
    e.target.value = '';
  };
}
