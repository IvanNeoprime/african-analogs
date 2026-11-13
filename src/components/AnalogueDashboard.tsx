import React, { useEffect, useMemo, useState } from 'react';
import { AnalogueSite, GeologicalSample, LatestAiAnalysisSnapshot } from '../types';
import { computeAnalogueFidelity, generateSpectralReflectanceCurve } from '../services/spectralEngine';
import {
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Layers,
  Compass,
  PieChart,
  Gauge,
  PencilLine,
  Sparkles,
  Check,
  X,
  Download,
} from 'lucide-react';

interface AnalogueDashboardProps {
  sites: AnalogueSite[];
  selectedSite: AnalogueSite;
  activeSample: GeologicalSample;
  latestAiAnalysis?: LatestAiAnalysisSnapshot | null;
  onSelectSite: (site: AnalogueSite) => void;
  onUpdateSample?: (updated: GeologicalSample) => void;
}

const PIE_PALETTE = [
  '#1E3A8A', // Azul Marinho
  '#0F766E', // Esmeralda
  '#D97706', // Âmbar
  '#2563EB', // Azul Real
  '#059669', // Verde Científico
  '#64748B', // Ardósia
];

export const AnalogueDashboard: React.FC<AnalogueDashboardProps> = ({
  sites,
  selectedSite,
  activeSample,
  latestAiAnalysis,
  onSelectSite,
  onUpdateSample,
}) => {
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);
  const [hoveredSliceIdx, setHoveredSliceIdx] = useState<number | null>(null);
  const [isEditingDashboard, setIsEditingDashboard] = useState(false);

  // Inline Dashboard Editor State (syncs with activeSample + AI analysis)
  const [dashName, setDashName] = useState(activeSample.name);
  const [dashLocation, setDashLocation] = useState(activeSample.customLocation || selectedSite.name);
  const [dashNotes, setDashNotes] = useState(activeSample.conclusion || activeSample.fieldNotes);
  const [dashWaterActivity, setDashWaterActivity] = useState(activeSample.waterActivity);
  const [dashPh, setDashPh] = useState(activeSample.pH);
  const [dashDepth, setDashDepth] = useState(activeSample.depthCm);
  const [dashMineralsText, setDashMineralsText] = useState(
    Object.entries(activeSample.minerals)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')
  );
  const [dashScores, setDashScores] = useState(activeSample.fidelityScores);
  const [dashXrf, setDashXrf] = useState<{ [oxide: string]: number }>(
    activeSample.xrfComposition || { SiO2: 49.8, Fe2O3: 17.2, Al2O3: 13.4, MgO: 7.9, CaO: 6.2 }
  );
  const [compareSiteId, setCompareSiteId] = useState<string>(selectedSite.id);
  const [dashSavedNotice, setDashSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    setCompareSiteId(selectedSite.id);
  }, [selectedSite.id]);

  const referenceSite = useMemo(
    () => sites.find((s) => s.id === compareSiteId) || selectedSite,
    [sites, compareSiteId, selectedSite]
  );

  useEffect(() => {
    setDashName(activeSample.name);
    setDashLocation(activeSample.customLocation || selectedSite.name);
    setDashNotes(activeSample.conclusion || activeSample.fieldNotes);
    setDashWaterActivity(activeSample.waterActivity);
    setDashPh(activeSample.pH);
    setDashDepth(activeSample.depthCm);
    setDashMineralsText(
      Object.entries(activeSample.minerals)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
    );
    setDashScores(activeSample.fidelityScores);
    setDashXrf({ ...(activeSample.xrfComposition || { SiO2: 49.8, Fe2O3: 17.2, Al2O3: 13.4, MgO: 7.9, CaO: 6.2 }) });
  }, [activeSample, selectedSite.name]);

  const parseMineralsInput = (text: string): Record<string, number> => {
    const map: Record<string, number> = {};
    const parts = text
      .split(/[,;\n]+/)
      .map((p) => p.trim())
      .filter(Boolean);

    parts.forEach((part) => {
      const match = part.match(/^(.+?)\s*[:=]\s*(\d+(?:[.,]\d+)?)/);
      if (match) {
        map[match[1].trim()] = Math.max(1, parseFloat(match[2].replace(',', '.')));
      } else {
        map[part] = 0;
      }
    });

    const keys = Object.keys(map);
    if (keys.length === 0) return { ...activeSample.minerals };
    const zeroKeys = keys.filter((k) => map[k] === 0);
    if (zeroKeys.length > 0) {
      const assigned = keys.reduce((s, k) => s + map[k], 0);
      const rem = Math.max(10, 100 - assigned);
      const each = Math.max(5, Math.round(rem / zeroKeys.length));
      zeroKeys.forEach((k) => {
        map[k] = each;
      });
    }
    return map;
  };

  const copilotGuidanceText = useMemo(() => {
    if (!latestAiAnalysis) return '';
    return [
      latestAiAnalysis.reportText,
      latestAiAnalysis.diagnosticResult,
      latestAiAnalysis.chatReply,
      latestAiAnalysis.visionClosestAnalogue
        ? `Copiloto Visual: imagem lembra ${latestAiAnalysis.visionClosestAnalogue}${
            latestAiAnalysis.visionMinerals?.length
              ? ` (minerais sugeridos: ${latestAiAnalysis.visionMinerals.join(', ')})`
              : ''
          }.`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  }, [latestAiAnalysis]);

  const handleCopyCopilotNotes = () => {
    if (!copilotGuidanceText) return;
    setDashNotes(copilotGuidanceText.slice(0, 700));
  };

  const handleSaveDashboardEdits = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateSample) return;
    const mineralsMap = parseMineralsInput(dashMineralsText);
    const updated: GeologicalSample = {
      ...activeSample,
      name: dashName.trim() || activeSample.name,
      customLocation: dashLocation.trim() || undefined,
      waterActivity: Math.min(1, Math.max(0, Number(dashWaterActivity) || 0)),
      pH: Math.min(14, Math.max(0, Number(dashPh) || 7)),
      depthCm: Math.max(0, Number(dashDepth) || 0),
      minerals: mineralsMap,
      xrfComposition: dashXrf,
      spectralCurve: generateSpectralReflectanceCurve(mineralsMap),
      fidelityScores: {
        mineralogy: Math.min(100, Math.max(0, Number(dashScores.mineralogy) || 0)),
        geomorphology: Math.min(100, Math.max(0, Number(dashScores.geomorphology) || 0)),
        geochemistry: Math.min(100, Math.max(0, Number(dashScores.geochemistry) || 0)),
        radiation: Math.min(100, Math.max(0, Number(dashScores.radiation) || 0)),
        thermal: Math.min(100, Math.max(0, Number(dashScores.thermal) || 0)),
        total: Math.min(100, Math.max(0, Number(dashScores.total) || 0)),
      },
      fieldNotes: dashNotes.trim() || activeSample.fieldNotes,
      conclusion: dashNotes.trim() || activeSample.conclusion,
    };
    onUpdateSample(updated);
    setIsEditingDashboard(false);
    setDashSavedNotice('Dados do painel e gráficos atualizados!');
    setTimeout(() => setDashSavedNotice(null), 3500);
  };

  const handleExportCsv = () => {
    const rows = [
      ['Campo', 'Valor'],
      ['Amostra', activeSample.name],
      ['Lugar', activeSample.customLocation || selectedSite.name],
      ['Planeta Alvo', activeSample.targetPlanet],
      ['Semelhanca Geral (%)', String(activeSample.fidelityScores.total)],
      ['Rochas (%)', String(activeSample.fidelityScores.mineralogy)],
      ['Terreno (%)', String(activeSample.fidelityScores.geomorphology)],
      ['Solo (%)', String(activeSample.fidelityScores.geochemistry)],
      ['Sol UV (%)', String(activeSample.fidelityScores.radiation)],
      ['Clima (%)', String(activeSample.fidelityScores.thermal)],
      ['Umidade (aw)', String(activeSample.waterActivity)],
      ['pH', String(activeSample.pH)],
      ['Profundidade (cm)', String(activeSample.depthCm)],
      ['Minerais', Object.entries(activeSample.minerals).map(([k, v]) => `${k}:${v}%`).join('; ')],
      ['Elementos Rocha', Object.entries(activeSample.xrfComposition || {}).map(([k, v]) => `${k}:${v}%`).join('; ')],
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeSample.id}_dados_painel.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const displayLocation = activeSample.customLocation || selectedSite.name;

  // 5-Axis Star / Radar Geometry
  const radarDimensions = [
    { key: 'mineralogy' as const, short: 'MIN', label: 'Mineralogia' },
    { key: 'geomorphology' as const, short: 'GEO', label: 'Geomorfologia' },
    { key: 'geochemistry' as const, short: 'CHM', label: 'Geoquímica' },
    { key: 'radiation' as const, short: 'RAD', label: 'Radiação' },
    { key: 'thermal' as const, short: 'TER', label: 'Térmica' },
  ];

  const getRadarPolygon = (
    scores: Record<'mineralogy' | 'geomorphology' | 'geochemistry' | 'radiation' | 'thermal', number>,
    radius = 80,
    cx = 120,
    cy = 112
  ) => {
    return radarDimensions
      .map((dim, idx) => {
        const angle = (Math.PI * 2 * idx) / radarDimensions.length - Math.PI / 2;
        const val = Math.max(0, Math.min(100, scores[dim.key] || 0)) / 100;
        const x = cx + Math.cos(angle) * radius * val;
        const y = cy + Math.sin(angle) * radius * val;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  // Pie / Donut Mineral Distribution Data
  const mineralSlices = useMemo(() => {
    const entries = Object.entries(activeSample.minerals)
      .filter(([, val]) => val > 0)
      .sort((a, b) => b[1] - a[1]);

    if (entries.length === 0) {
      return [{ name: 'Matriz Basal', value: 100, pct: 100, color: PIE_PALETTE[0] }];
    }

    const totalSum = entries.reduce((acc, [, v]) => acc + v, 0) || 1;
    const topEntries = entries.slice(0, 5);
    const othersSum = entries.slice(5).reduce((acc, [, v]) => acc + v, 0);
    const combined = othersSum > 0 ? [...topEntries, ['Outros Minerais', othersSum] as [string, number]] : topEntries;

    return combined.map(([name, val], idx) => ({
      name,
      value: val,
      pct: Math.round((val / totalSum) * 1000) / 10,
      color: PIE_PALETTE[idx % PIE_PALETTE.length],
    }));
  }, [activeSample.minerals]);

  // SVG Donut Arc Calculations
  const donutSegments = useMemo(() => {
    const radius = 58;
    const circumference = 2 * Math.PI * radius;
    let cumulativeFraction = 0;

    return mineralSlices.map((slice, idx) => {
      const fraction = slice.pct / 100;
      const dashLength = Math.max(0, fraction * circumference);
      const dashOffset = -cumulativeFraction * circumference;
      cumulativeFraction += fraction;
      return {
        ...slice,
        idx,
        radius,
        circumference,
        dashArray: `${dashLength.toFixed(2)} ${(circumference - dashLength).toFixed(2)}`,
        dashOffset: dashOffset.toFixed(2),
      };
    });
  }, [mineralSlices]);

  // Arc Gauge Calculations (AFI 0..100%)
  const afiScore = Math.max(0, Math.min(100, activeSample.fidelityScores.total));
  const arcRadius = 74;
  const arcHalfCircumference = Math.PI * arcRadius;
  const arcActiveLength = (afiScore / 100) * arcHalfCircumference;
  const arcCategory =
    afiScore >= 80
      ? { text: 'Alta Fidelidade Análoga', colorClass: 'text-[#15803D] dark:text-[#4ADE80]', stroke: '#15803D' }
      : afiScore >= 60
      ? { text: 'Aderência Moderada', colorClass: 'text-[#B45309] dark:text-[#FBBF24]', stroke: '#D97706' }
      : { text: 'Baixa Aderência', colorClass: 'text-[#B91C1C] dark:text-[#FCA5A5]', stroke: '#B91C1C' };

  // Dynamic Everyday Pros & Cons
  const prosAndCons = useMemo(() => {
    const pros: string[] = [];
    const cons: string[] = [];

    if (activeSample.waterActivity <= 0.35) {
      pros.push(
        `Solo bem seco (umidade ${activeSample.waterActivity}), muito parecido com o clima seco de ${activeSample.targetPlanet}.`
      );
    } else {
      cons.push(
        `Umidade um pouco alta (${activeSample.waterActivity}) comparada aos ambientes secos de ${activeSample.targetPlanet}.`
      );
    }

    if (activeSample.pH < 3.0 || activeSample.pH > 9.5) {
      pros.push(
        `Acidez/alcalinidade extrema (pH ${activeSample.pH}), semelhante a lagos e fontes raras em outros planetas.`
      );
    } else {
      pros.push(
        `Solo equilibrado (pH ${activeSample.pH}), que ajuda a preservar minerais e sinais antigos.`
      );
    }

    const mineralList = Object.keys(activeSample.minerals);
    if (mineralList.length > 0) {
      pros.push(
        `Minerais principais identificados (${mineralList.slice(0, 3).join(', ')}) combinam com os registros da NASA.`
      );
    }

    if (selectedSite.atmosphericPressureMbar > 700) {
      cons.push(
        `Aqui na Terra o ar é mais denso que em ${activeSample.targetPlanet}, o que muda testes ao ar livre.`
      );
    }

    if (selectedSite.uvRadiationWm2 < 50) {
      cons.push(
        `Pouca luz solar UV no local (${selectedSite.uvRadiationWm2} W/m²) exige atenção extra em testes de radiação.`
      );
    } else {
      pros.push(
        `Sol forte (${selectedSite.uvRadiationWm2} W/m²) ótimo para testar como a radiação afeta o solo.`
      );
    }

    if (activeSample.fidelityScores.total < 85) {
      cons.push(
        `Semelhança atual de ${activeSample.fidelityScores.total}% mostra que vale testar mais amostras ou outra região.`
      );
    }

    return { pros, cons };
  }, [activeSample, selectedSite]);

  // Similarity Ranking
  const similarityRanking = useMemo(() => {
    return [...sites]
      .map((site) => {
        const targetBonus =
          site.targetPlanet === activeSample.targetPlanet || site.targetPlanet === 'Both' ? 6 : -10;
        const awDelta = Math.abs(site.waterActivityAw - activeSample.waterActivity);
        const awScore = Math.max(0, 10 - awDelta * 18);
        const similarity = Math.min(99, Math.max(42, Math.round(site.fidelityScore * 0.88 + targetBonus + awScore)));
        return { site, similarity };
      })
      .sort((a, b) => b.similarity - a.similarity);
  }, [sites, activeSample.targetPlanet, activeSample.waterActivity]);

  // Spectral Line Chart Coordinates (400nm - 2500nm)
  const sampleCurve =
    activeSample.spectralCurve.length > 1 ? activeSample.spectralCurve : referenceSite.sampleSpectralCurve;
  const siteCurve = referenceSite.sampleSpectralCurve;

  const mapX = (wl: number) => 42 + ((wl - 400) / (2500 - 400)) * 450;
  const mapY = (ref: number) => 152 - Math.max(0, Math.min(0.85, ref)) * 148;
  const toPolyline = (pts: { wavelengthNm: number; reflectance: number }[]) =>
    pts.map((p) => `${mapX(p.wavelengthNm).toFixed(1)},${mapY(p.reflectance).toFixed(1)}`).join(' ');

  const xrfEntries = useMemo(() => {
    return Object.entries(activeSample.xrfComposition || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [activeSample.xrfComposition]);

  const oxidePlainName: Record<string, string> = {
    SiO2: 'Sílica (Areia/Quartzo)',
    Fe2O3: 'Óxido de Ferro',
    Al2O3: 'Alumínio',
    MgO: 'Magnésio',
    CaO: 'Cálcio',
    SO3: 'Enxofre / Sulfato',
    TiO2: 'Titânio',
  };

  return (
    <section aria-labelledby="dashboard-heading" className="space-y-5">
      {/* Compact Header with Inline Edit Toggle */}
      <div className="bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl px-6 py-4 shadow-xs space-y-4 transition-colors duration-150">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 id="dashboard-heading" className="font-poppins text-lg font-bold text-[#0F172A] dark:text-[#F0F6FC] tracking-tight">
              Painel de Resultados &amp; Gráficos
            </h2>
            <p className="text-xs sm:text-sm text-[#475569] dark:text-[#94A3B8] mt-0.5">
              <strong className="text-[#0F172A] dark:text-[#F0F6FC]">{activeSample.name}</strong> · Lugar:{' '}
              <strong className="text-[#0F172A] dark:text-[#F0F6FC]">{displayLocation}</strong> · Comparando com{' '}
              <strong className="text-[#1E3A8A] dark:text-[#60A5FA]">{activeSample.targetPlanet}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <select
              aria-label="Escolher referência de comparação nos gráficos"
              value={compareSiteId}
              onChange={(e) => setCompareSiteId(e.target.value)}
              className="bg-[#F1F5F9] dark:bg-[#21262D] text-[#0F172A] dark:text-[#F0F6FC] text-xs font-medium px-3 py-1.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] cursor-pointer"
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  Ref.: {s.name.split(' (')[0]}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleExportCsv}
              className="py-1.5 px-3 rounded-xl bg-[#F1F5F9] dark:bg-[#21262D] hover:bg-[#E2E8F0] dark:hover:bg-[#30363D] text-[#0F172A] dark:text-[#F0F6FC] text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#2DD4BF]" />
              <span>CSV</span>
            </button>

            {onUpdateSample && (
              <button
                type="button"
                onClick={() => setIsEditingDashboard((prev) => !prev)}
                className={`py-1.5 px-3 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isEditingDashboard
                    ? 'bg-[#1E3A8A] dark:bg-[#2563EB] text-[#FFFFFF]'
                    : 'bg-[#F1F5F9] dark:bg-[#21262D] hover:bg-[#E2E8F0] dark:hover:bg-[#30363D] text-[#0F172A] dark:text-[#F0F6FC]'
                }`}
              >
                {isEditingDashboard ? <X className="w-3.5 h-3.5" /> : <PencilLine className="w-3.5 h-3.5" />}
                <span>{isEditingDashboard ? 'Fechar Edição' : 'Editar Dados do Painel'}</span>
              </button>
            )}
          </div>
        </div>

        {dashSavedNotice && (
          <div role="status" className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs text-[#15803D] dark:text-[#4ADE80] flex items-center gap-1.5">
            <Check className="w-4 h-4 shrink-0" />
            <span>{dashSavedNotice}</span>
          </div>
        )}

        {isEditingDashboard && onUpdateSample && (
          <form onSubmit={handleSaveDashboardEdits} className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-[#0F172A] dark:text-[#F0F6FC]">
                  Editar dados manuais dos gráficos e lugar
                </div>
                <div className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                  Os valores dos gráficos e medidas são inseridos manualmente por você.
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {copilotGuidanceText && (
                  <button
                    type="button"
                    onClick={handleCopyCopilotNotes}
                    className="py-1.5 px-3 rounded-lg bg-[#FFFFFF] dark:bg-[#161B22] text-[#1E3A8A] dark:text-[#60A5FA] text-xs font-medium inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Copiar texto do copiloto p/ conclusão</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const mineralsMap = parseMineralsInput(dashMineralsText);
                    setDashScores(
                      computeAnalogueFidelity(
                        {
                          targetPlanet: activeSample.targetPlanet,
                          waterActivity: dashWaterActivity,
                          pH: dashPh,
                          depthCm: dashDepth,
                          porosityPercent: activeSample.porosityPercent,
                          minerals: mineralsMap,
                        },
                        activeSample.targetPlanet
                      )
                    );
                  }}
                  className="py-1.5 px-3 rounded-lg bg-[#FFFFFF] dark:bg-[#161B22] text-xs font-medium text-[#0F766E] dark:text-[#2DD4BF] shadow-xs cursor-pointer"
                >
                  Recalcular pelo solo
                </button>
              </div>
            </div>

            {copilotGuidanceText && (
              <div className="p-3 rounded-xl bg-[#FFFFFF] dark:bg-[#161B22] space-y-1 text-xs">
                <div className="font-semibold text-[#1E3A8A] dark:text-[#60A5FA] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Parecer do Copiloto IA (apenas apoio à leitura)</span>
                </div>
                <p className="text-[#475569] dark:text-[#94A3B8] line-clamp-3 leading-relaxed">
                  {copilotGuidanceText}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="dash-edit-name" className="block text-xs text-[#475569] dark:text-[#94A3B8] mb-1">
                  Nome do Estudo / Amostra
                </label>
                <input
                  id="dash-edit-name"
                  type="text"
                  value={dashName}
                  onChange={(e) => setDashName(e.target.value)}
                  className="w-full bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#F0F6FC] text-xs px-3 py-2 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="dash-edit-loc" className="block text-xs text-[#475569] dark:text-[#94A3B8] mb-1">
                  Lugar (escrito manualmente)
                </label>
                <input
                  id="dash-edit-loc"
                  type="text"
                  value={dashLocation}
                  onChange={(e) => setDashLocation(e.target.value)}
                  placeholder="Ex.: Deserto do Namibe, Angola"
                  className="w-full bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#F0F6FC] text-xs px-3 py-2 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
              <div>
                <label htmlFor="dash-score-total" className="block text-[#475569] dark:text-[#94A3B8] mb-1">
                  Semelhança (%)
                </label>
                <input
                  id="dash-score-total"
                  type="number"
                  min="0"
                  max="100"
                  value={dashScores.total}
                  onChange={(e) => setDashScores((p) => ({ ...p, total: Number(e.target.value) }))}
                  className="w-full bg-[#FFFFFF] dark:bg-[#161B22] font-mono text-xs px-2.5 py-2 rounded-lg tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="dash-score-min" className="block text-[#475569] dark:text-[#94A3B8] mb-1">
                  Rochas (%)
                </label>
                <input
                  id="dash-score-min"
                  type="number"
                  min="0"
                  max="100"
                  value={dashScores.mineralogy}
                  onChange={(e) => setDashScores((p) => ({ ...p, mineralogy: Number(e.target.value) }))}
                  className="w-full bg-[#FFFFFF] dark:bg-[#161B22] font-mono text-xs px-2.5 py-2 rounded-lg tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="dash-score-geo" className="block text-[#475569] dark:text-[#94A3B8] mb-1">
                  Terreno (%)
                </label>
                <input
                  id="dash-score-geo"
                  type="number"
                  min="0"
                  max="100"
                  value={dashScores.geomorphology}
                  onChange={(e) => setDashScores((p) => ({ ...p, geomorphology: Number(e.target.value) }))}
                  className="w-full bg-[#FFFFFF] dark:bg-[#161B22] font-mono text-xs px-2.5 py-2 rounded-lg tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="dash-score-chm" className="block text-[#475569] dark:text-[#94A3B8] mb-1">
                  Solo (%)
                </label>
                <input
                  id="dash-score-chm"
                  type="number"
                  min="0"
                  max="100"
                  value={dashScores.geochemistry}
                  onChange={(e) => setDashScores((p) => ({ ...p, geochemistry: Number(e.target.value) }))}
                  className="w-full bg-[#FFFFFF] dark:bg-[#161B22] font-mono text-xs px-2.5 py-2 rounded-lg tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="dash-score-rad" className="block text-[#475569] dark:text-[#94A3B8] mb-1">
                  Sol UV (%)
                </label>
                <input
                  id="dash-score-rad"
                  type="number"
                  min="0"
                  max="100"
                  value={dashScores.radiation}
                  onChange={(e) => setDashScores((p) => ({ ...p, radiation: Number(e.target.value) }))}
                  className="w-full bg-[#FFFFFF] dark:bg-[#161B22] font-mono text-xs px-2.5 py-2 rounded-lg tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="dash-score-ter" className="block text-[#475569] dark:text-[#94A3B8] mb-1">
                  Clima (%)
                </label>
                <input
                  id="dash-score-ter"
                  type="number"
                  min="0"
                  max="100"
                  value={dashScores.thermal}
                  onChange={(e) => setDashScores((p) => ({ ...p, thermal: Number(e.target.value) }))}
                  className="w-full bg-[#FFFFFF] dark:bg-[#161B22] font-mono text-xs px-2.5 py-2 rounded-lg tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="sm:col-span-2">
                <label htmlFor="dash-edit-minerals" className="block text-[#475569] dark:text-[#94A3B8] mb-1">
                  Minerais no Gráfico de Pizza (ex.: Basalto: 50, Ferro: 30, Gesso: 20)
                </label>
                <input
                  id="dash-edit-minerals"
                  type="text"
                  value={dashMineralsText}
                  onChange={(e) => setDashMineralsText(e.target.value)}
                  className="w-full bg-[#FFFFFF] dark:bg-[#161B22] text-xs px-3 py-2 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="dash-edit-aw" className="block text-[#475569] dark:text-[#94A3B8] mb-1">
                  Umidade (0–1)
                </label>
                <input
                  id="dash-edit-aw"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={dashWaterActivity}
                  onChange={(e) => setDashWaterActivity(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#FFFFFF] dark:bg-[#161B22] font-mono text-xs px-2.5 py-2 rounded-lg tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="dash-edit-ph" className="block text-[#475569] dark:text-[#94A3B8] mb-1">
                  Acidez (pH)
                </label>
                <input
                  id="dash-edit-ph"
                  type="number"
                  step="0.1"
                  min="0"
                  max="14"
                  value={dashPh}
                  onChange={(e) => setDashPh(parseFloat(e.target.value) || 7)}
                  className="w-full bg-[#FFFFFF] dark:bg-[#161B22] font-mono text-xs px-2.5 py-2 rounded-lg tabular-nums"
                />
              </div>
            </div>

            <div>
              <span className="block text-[11px] font-medium text-[#475569] dark:text-[#94A3B8] mb-1.5">
                Elementos da Rocha (%) — Gráfico de Barras
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {Object.entries(dashXrf).map(([oxide, val]) => (
                  <div key={oxide}>
                    <label htmlFor={`dash-xrf-${oxide}`} className="block text-[11px] text-[#475569] dark:text-[#94A3B8] mb-0.5">
                      {oxide}
                    </label>
                    <input
                      id={`dash-xrf-${oxide}`}
                      type="number"
                      step="0.1"
                      min={0}
                      max={100}
                      value={val}
                      onChange={(e) =>
                        setDashXrf((prev) => ({
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

            <div>
              <label htmlFor="dash-edit-notes" className="block text-xs text-[#475569] dark:text-[#94A3B8] mb-1">
                Observações / Conclusão da Análise
              </label>
              <textarea
                id="dash-edit-notes"
                rows={2}
                value={dashNotes}
                onChange={(e) => setDashNotes(e.target.value)}
                className="w-full bg-[#FFFFFF] dark:bg-[#161B22] text-xs p-2.5 rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditingDashboard(false)}
                className="py-2 px-4 rounded-xl bg-[#FFFFFF] dark:bg-[#161B22] text-xs font-medium text-[#475569] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="py-2 px-5 rounded-xl bg-[#1E3A8A] dark:bg-[#2563EB] text-[#FFFFFF] text-xs font-medium cursor-pointer"
              >
                Salvar nos Gráficos
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 1. Simple KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-medium text-[#475569] dark:text-[#94A3B8]">Semelhança Geral</span>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-[#1E3A8A] dark:text-[#60A5FA] tabular-nums my-1.5">
            {activeSample.fidelityScores.total}%
          </div>
          <span className={`text-xs font-medium ${arcCategory.colorClass}`}>{arcCategory.text}</span>
        </div>

        <div className="bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-medium text-[#475569] dark:text-[#94A3B8]">Minerais Parecidos</span>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-[#0F172A] dark:text-[#F0F6FC] tabular-nums my-1.5">
            {activeSample.fidelityScores.mineralogy}%
          </div>
          <span className="text-xs text-[#475569] dark:text-[#94A3B8] truncate">
            {mineralSlices.slice(0, 2).map((m) => m.name).join(' · ')}
          </span>
        </div>

        <div className="bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-medium text-[#475569] dark:text-[#94A3B8]">Solo &amp; Química</span>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-[#0F172A] dark:text-[#F0F6FC] tabular-nums my-1.5">
            {activeSample.fidelityScores.geochemistry}%
          </div>
          <span className="text-xs text-[#475569] dark:text-[#94A3B8] tabular-nums">
            Umidade {activeSample.waterActivity} · pH {activeSample.pH}
          </span>
        </div>

        <div className="bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-medium text-[#475569] dark:text-[#94A3B8]">Sol &amp; Temperatura</span>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-[#0F172A] dark:text-[#F0F6FC] tabular-nums my-1.5">
            {Math.round((activeSample.fidelityScores.thermal + activeSample.fidelityScores.radiation) / 2)}%
          </div>
          <span className="text-xs text-[#475569] dark:text-[#94A3B8] tabular-nums">
            Sol UV: {selectedSite.uvRadiationWm2} W/m²
          </span>
        </div>
      </div>

      {/* 2. Multi-Chart Visual Bento Row: Arc Gauge (4) | Mineral Pie (4) | 5-Axis Star Chart (4) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-5 items-stretch">
        {/* CHART A: ARC GAUGE */}
        <div className="xl:col-span-4 bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="font-poppins text-sm font-semibold text-[#0F172A] dark:text-[#F0F6FC] flex items-center gap-2">
              <Gauge className="w-4 h-4 text-[#1E3A8A] dark:text-[#60A5FA]" strokeWidth={1.75} aria-hidden="true" />
              <span>Gráfico de Arco — Nível de Semelhança</span>
            </h3>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-0.5">
              Mostra o quanto este lugar se parece com {activeSample.targetPlanet}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center py-1">
            <svg viewBox="0 0 200 124" className="w-full max-w-[240px] h-auto" role="img" aria-label={`Gráfico de arco mostrando semelhança de ${afiScore}%`}>
              <path
                d="M 26 102 A 74 74 0 0 1 174 102"
                fill="none"
                className="stroke-[#E2E8F0] dark:stroke-[#21262D]"
                strokeWidth="16"
                strokeLinecap="round"
              />
              <path
                d="M 26 102 A 74 74 0 0 1 174 102"
                fill="none"
                stroke="#0F766E"
                strokeOpacity="0.22"
                strokeWidth="16"
                strokeDasharray={`${(arcHalfCircumference * 0.2).toFixed(1)} ${arcHalfCircumference.toFixed(1)}`}
                strokeDashoffset={(-arcHalfCircumference * 0.8).toFixed(1)}
              />
              <path
                d="M 26 102 A 74 74 0 0 1 174 102"
                fill="none"
                stroke={arcCategory.stroke}
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${arcActiveLength.toFixed(2)} ${arcHalfCircumference.toFixed(2)}`}
              />
              <text
                x="100"
                y="84"
                textAnchor="middle"
                className="fill-[#0F172A] dark:fill-[#F0F6FC] text-2xl font-bold font-mono"
              >
                {afiScore.toFixed(0)}%
              </text>
              <text
                x="100"
                y="102"
                textAnchor="middle"
                className="fill-[#475569] dark:fill-[#94A3B8] text-[10px] font-medium"
              >
                COM {activeSample.targetPlanet.toUpperCase()}
              </text>
              <text x="22" y="118" textAnchor="middle" className="fill-[#64748B] text-[9px] font-mono">0%</text>
              <text x="100" y="18" textAnchor="middle" className="fill-[#64748B] text-[9px] font-mono">50%</text>
              <text x="178" y="118" textAnchor="middle" className="fill-[#64748B] text-[9px] font-mono">100%</text>
            </svg>
          </div>

          <div className="bg-[#F8FAFC] dark:bg-[#0D1117] rounded-xl p-3 space-y-1.5 text-xs">
            <div className="font-semibold text-[#0F172A] dark:text-[#F0F6FC]">Legenda do medidor:</div>
            <div className="grid grid-cols-3 gap-2 text-[#475569] dark:text-[#94A3B8] text-[11px]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#B91C1C] shrink-0" />
                <span>0–59% Baixa</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#D97706] shrink-0" />
                <span>60–79% Média</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#15803D] shrink-0" />
                <span>80–100% Alta</span>
              </span>
            </div>
          </div>
        </div>

        {/* CHART B: PIE / DONUT CHART */}
        <div className="xl:col-span-4 bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="font-poppins text-sm font-semibold text-[#0F172A] dark:text-[#F0F6FC] flex items-center gap-2">
              <PieChart className="w-4 h-4 text-[#0F766E] dark:text-[#2DD4BF]" strokeWidth={1.75} aria-hidden="true" />
              <span>Gráfico de Pizza — Do que é Feito o Solo</span>
            </h3>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-0.5">
              Porcentagem de cada tipo de mineral encontrado
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <svg viewBox="0 0 160 160" className="w-36 h-36 shrink-0" role="img" aria-label="Gráfico de pizza dos minerais do solo">
              <g transform="rotate(-90 80 80)">
                {donutSegments.map((seg) => (
                  <circle
                    key={seg.name}
                    cx="80"
                    cy="80"
                    r={seg.radius}
                    fill="transparent"
                    stroke={seg.color}
                    strokeWidth={hoveredSliceIdx === seg.idx ? 24 : 20}
                    strokeDasharray={seg.dashArray}
                    strokeDashoffset={seg.dashOffset}
                    className="transition-all duration-150 cursor-pointer"
                    onMouseEnter={() => setHoveredSliceIdx(seg.idx)}
                    onMouseLeave={() => setHoveredSliceIdx(null)}
                  />
                ))}
              </g>
              <text x="80" y="76" textAnchor="middle" className="fill-[#0F172A] dark:fill-[#F0F6FC] text-sm font-bold font-mono">
                {hoveredSliceIdx !== null && mineralSlices[hoveredSliceIdx]
                  ? `${mineralSlices[hoveredSliceIdx].pct}%`
                  : `${mineralSlices.length}`}
              </text>
              <text x="80" y="92" textAnchor="middle" className="fill-[#475569] dark:fill-[#94A3B8] text-[9px] font-medium">
                {hoveredSliceIdx !== null && mineralSlices[hoveredSliceIdx]
                  ? mineralSlices[hoveredSliceIdx].name.slice(0, 12)
                  : 'Minerais'}
              </text>
            </svg>

            <div className="w-full space-y-1.5 text-xs">
              {mineralSlices.map((slice, idx) => (
                <div
                  key={slice.name}
                  onMouseEnter={() => setHoveredSliceIdx(idx)}
                  onMouseLeave={() => setHoveredSliceIdx(null)}
                  className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                    hoveredSliceIdx === idx
                      ? 'bg-[#F1F5F9] dark:bg-[#21262D]'
                      : 'bg-[#F8FAFC] dark:bg-[#0D1117]'
                  }`}
                >
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="truncate text-[#0F172A] dark:text-[#F0F6FC] font-medium">
                      {slice.name}
                    </span>
                  </span>
                  <span className="font-mono font-semibold text-[#1E3A8A] dark:text-[#60A5FA] tabular-nums shrink-0">
                    {slice.pct}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-[#475569] dark:text-[#94A3B8] bg-[#F8FAFC] dark:bg-[#0D1117] px-3 py-2 rounded-xl">
            Legenda: passe o mouse sobre uma cor ou nome para destacar sua parte no gráfico.
          </div>
        </div>

        {/* CHART C: 5-AXIS STAR / RADAR CHART */}
        <div className="xl:col-span-4 md:col-span-2 bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-3">
          <div>
            <h3 className="font-poppins text-sm font-semibold text-[#0F172A] dark:text-[#F0F6FC] flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#1E3A8A] dark:text-[#60A5FA]" strokeWidth={1.75} aria-hidden="true" />
              <span>Gráfico Estrela — 5 Pontos</span>
            </h3>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-0.5">
              Compara seu estudo com o padrão da NASA em 5 áreas
            </p>
          </div>

          <div className="flex flex-col sm:flex-row xl:flex-col items-center justify-center gap-3">
            <svg viewBox="0 0 240 220" className="w-full max-w-[235px] h-auto" role="img" aria-label="Gráfico estrela de comparação em 5 áreas">
              {[0.25, 0.5, 0.75, 1].map((scale) => (
                <polygon
                  key={scale}
                  points={radarDimensions
                    .map((_, idx) => {
                      const angle = (Math.PI * 2 * idx) / radarDimensions.length - Math.PI / 2;
                      const x = 120 + Math.cos(angle) * 80 * scale;
                      const y = 112 + Math.sin(angle) * 80 * scale;
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    })
                    .join(' ')}
                  fill="none"
                  className="stroke-[#E2E8F0] dark:stroke-[#30363D]"
                  strokeWidth="1"
                />
              ))}

              {radarDimensions.map((dim, idx) => {
                const angle = (Math.PI * 2 * idx) / radarDimensions.length - Math.PI / 2;
                const x2 = 120 + Math.cos(angle) * 80;
                const y2 = 112 + Math.sin(angle) * 80;
                const lx = 120 + Math.cos(angle) * 97;
                const ly = 112 + Math.sin(angle) * 97;
                return (
                  <g key={dim.key}>
                    <line x1="120" y1="112" x2={x2} y2={y2} className="stroke-[#E2E8F0] dark:stroke-[#30363D]" strokeWidth="1" />
                    <text
                      x={lx}
                      y={ly}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-[#475569] dark:fill-[#94A3B8] text-[9px] font-mono font-semibold"
                    >
                      {dim.short} ({activeSample.fidelityScores[dim.key]}%)
                    </text>
                  </g>
                );
              })}

              <polygon
                points={getRadarPolygon(referenceSite.radarAxes)}
                className="fill-[#0F766E]/12 stroke-[#0F766E] dark:stroke-[#2DD4BF]"
                strokeWidth="1.6"
                strokeDasharray="3 3"
              />

              <polygon
                points={getRadarPolygon(activeSample.fidelityScores)}
                className="fill-[#1E3A8A]/22 dark:fill-[#3B82F6]/25 stroke-[#1E3A8A] dark:stroke-[#60A5FA]"
                strokeWidth="2.2"
              />
            </svg>
          </div>

          <div className="bg-[#F8FAFC] dark:bg-[#0D1117] rounded-xl p-3 space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-[#0F172A] dark:text-[#F0F6FC] font-medium">
                <span className="w-3 h-2 rounded-xs bg-[#1E3A8A] dark:bg-[#60A5FA] inline-block" />
                <span>Sua amostra</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#475569] dark:text-[#94A3B8]">
                <span className="w-3 h-0.5 border-t-2 border-dashed border-[#0F766E] dark:border-[#2DD4BF] inline-block" />
                <span>Referência NASA ({referenceSite.name.split(' ')[0]})</span>
              </span>
            </div>
            <div className="text-[11px] text-center text-[#64748B] dark:text-[#8B949E]">
              MIN: Minerais · GEO: Terreno · CHM: Química · RAD: Luz UV · TER: Temperatura
            </div>
          </div>
        </div>
      </div>

      {/* 3. Full Line Chart + Composition Bar Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-8 bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-poppins text-sm font-semibold text-[#0F172A] dark:text-[#F0F6FC] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#1E3A8A] dark:text-[#60A5FA]" strokeWidth={1.75} aria-hidden="true" />
                <span>Gráfico de Linhas — Reflexo da Luz no Solo</span>
              </h3>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-0.5">
                Compara como a luz reflete na sua amostra e no padrão do satélite
              </p>
            </div>
            {hoveredPointIdx !== null && sampleCurve[hoveredPointIdx] ? (
              <span className="text-xs font-mono bg-[#1E3A8A] dark:bg-[#2563EB] text-[#FFFFFF] px-3 py-1.5 rounded-lg tabular-nums">
                {sampleCurve[hoveredPointIdx].wavelengthNm} nm · {(sampleCurve[hoveredPointIdx].reflectance * 100).toFixed(1)}% de reflexo
              </span>
            ) : (
              <span className="text-[11px] text-[#475569] dark:text-[#94A3B8] bg-[#F1F5F9] dark:bg-[#21262D] px-2.5 py-1 rounded-lg">
                Passe o mouse nos pontos da linha
              </span>
            )}
          </div>

          <div className="w-full overflow-x-auto bg-[#F8FAFC] dark:bg-[#0D1117] rounded-xl p-3">
            <svg viewBox="0 0 510 182" className="w-full min-w-[380px] h-auto" role="img" aria-label="Gráfico de linhas comparando reflexo de luz">
              <rect x={mapX(400)} y="8" width={mapX(700) - mapX(400)} height="144" className="fill-[#1E3A8A]/5 dark:fill-[#60A5FA]/5" />
              <rect x={mapX(1400)} y="8" width={mapX(2500) - mapX(1400)} height="144" className="fill-[#0F766E]/5 dark:fill-[#2DD4BF]/5" />

              <text x={(mapX(400) + mapX(700)) / 2} y="18" textAnchor="middle" className="fill-[#64748B] text-[8px] font-sans">
                Luz Visível
              </text>
              <text x={(mapX(700) + mapX(1400)) / 2} y="18" textAnchor="middle" className="fill-[#64748B] text-[8px] font-sans">
                Ferro / Rocha
              </text>
              <text x={(mapX(1400) + mapX(2500)) / 2} y="18" textAnchor="middle" className="fill-[#64748B] text-[8px] font-sans">
                Água / Sais / Argila
              </text>

              {[0.2, 0.4, 0.6, 0.8].map((val) => {
                const y = mapY(val);
                return (
                  <g key={val}>
                    <line x1="42" y1={y} x2="492" y2={y} className="stroke-[#E2E8F0] dark:stroke-[#30363D]" strokeWidth="1" />
                    <text x="34" y={y + 3} textAnchor="end" className="fill-[#64748B] dark:fill-[#8B949E] text-[9px] font-mono">
                      {(val * 100).toFixed(0)}%
                    </text>
                  </g>
                );
              })}

              {[400, 700, 1000, 1400, 1900, 2200, 2500].map((wl) => (
                <text
                  key={wl}
                  x={mapX(wl)}
                  y="170"
                  textAnchor="middle"
                  className="fill-[#64748B] dark:fill-[#8B949E] text-[9px] font-mono"
                >
                  {wl} nm
                </text>
              ))}

              <polyline
                fill="none"
                className="stroke-[#0F766E] dark:stroke-[#2DD4BF]"
                strokeWidth="1.8"
                strokeDasharray="5 3"
                points={toPolyline(siteCurve)}
              />

              <polyline
                fill="none"
                className="stroke-[#1E3A8A] dark:stroke-[#60A5FA]"
                strokeWidth="2.4"
                points={toPolyline(sampleCurve)}
              />

              {sampleCurve.map((pt, idx) => (
                <circle
                  key={pt.wavelengthNm}
                  cx={mapX(pt.wavelengthNm)}
                  cy={mapY(pt.reflectance)}
                  r={hoveredPointIdx === idx ? 5.5 : 3.5}
                  className="fill-[#1E3A8A] dark:fill-[#60A5FA] cursor-pointer transition-all"
                  onMouseEnter={() => setHoveredPointIdx(idx)}
                  onMouseLeave={() => setHoveredPointIdx(null)}
                />
              ))}
            </svg>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F8FAFC] dark:bg-[#0D1117] px-3.5 py-2.5 rounded-xl text-xs">
            <div className="flex flex-wrap items-center gap-5">
              <span className="inline-flex items-center gap-2 font-medium text-[#0F172A] dark:text-[#F0F6FC]">
                <span className="w-5 h-0.5 bg-[#1E3A8A] dark:bg-[#60A5FA] inline-block" />
                <span>Sua amostra ({activeSample.name})</span>
              </span>
              <span className="inline-flex items-center gap-2 text-[#475569] dark:text-[#94A3B8]">
                <span className="w-5 h-0.5 border-t-2 border-dashed border-[#0F766E] dark:border-[#2DD4BF] inline-block" />
                <span>Padrão NASA ({referenceSite.name})</span>
              </span>
            </div>
            <span className="text-[11px] text-[#64748B] dark:text-[#8B949E]">
              Horizontal: tipo de luz · Vertical: brilho refletido (%)
            </span>
          </div>
        </div>

        <div className="lg:col-span-4 bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="font-poppins text-sm font-semibold text-[#0F172A] dark:text-[#F0F6FC]">
              Principais Elementos da Rocha
            </h3>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-0.5">
              Quantidade de cada componente encontrado no solo
            </p>
          </div>

          <div className="space-y-3 flex-1 flex flex-col justify-center">
            {xrfEntries.map(([oxide, val], i) => {
              const color = PIE_PALETTE[i % PIE_PALETTE.length];
              return (
                <div key={oxide} className="space-y-1">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <span className="inline-flex items-center gap-2 font-medium text-[#0F172A] dark:text-[#F0F6FC] truncate">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                      <span className="truncate">{oxidePlainName[oxide] || oxide}</span>
                    </span>
                    <span className="font-mono font-semibold text-[#0F172A] dark:text-[#F0F6FC] tabular-nums shrink-0">
                      {val}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#F1F5F9] dark:bg-[#0D1117] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-200"
                      style={{ width: `${Math.min(100, val)}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-[#F8FAFC] dark:bg-[#0D1117] px-3 py-2 rounded-xl text-[11px] text-[#475569] dark:text-[#94A3B8] flex items-center justify-between">
            <span>Legenda: porcentagem na amostra</span>
            <span className="font-mono">{activeSample.depthCm} cm de fundo</span>
          </div>
        </div>
      </div>

      {/* 4. Symmetric 3-Bowl Japanese Bento Evaluation: Pontos Fortes | Limites | Lugares Mais Parecidos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-4 bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-6 shadow-xs flex flex-col space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="font-poppins text-sm font-semibold text-[#15803D] dark:text-[#4ADE80] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span>Pontos Fortes (Prós)</span>
            </h3>
            <span className="text-xs font-mono text-[#15803D] dark:text-[#4ADE80] tabular-nums">
              {prosAndCons.pros.length}
            </span>
          </div>
          <ul className="space-y-2.5 text-xs text-[#0F172A] dark:text-[#E2E8F0] leading-relaxed flex-1">
            {prosAndCons.pros.map((item, idx) => (
              <li key={idx} className="p-3.5 rounded-xl bg-emerald-50/75 dark:bg-emerald-950/30">
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-4 bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-6 shadow-xs flex flex-col space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="font-poppins text-sm font-semibold text-[#B45309] dark:text-[#FBBF24] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span>Diferenças e Limites (Contras)</span>
            </h3>
            <span className="text-xs font-mono text-[#B45309] dark:text-[#FBBF24] tabular-nums">
              {prosAndCons.cons.length}
            </span>
          </div>
          <ul className="space-y-2.5 text-xs text-[#0F172A] dark:text-[#E2E8F0] leading-relaxed flex-1">
            {prosAndCons.cons.length > 0 ? (
              prosAndCons.cons.map((item, idx) => (
                <li key={idx} className="p-3.5 rounded-xl bg-amber-50/75 dark:bg-amber-950/30">
                  {item}
                </li>
              ))
            ) : (
              <li className="p-3.5 rounded-xl bg-[#F1F5F9] dark:bg-[#21262D] text-[#475569] dark:text-[#94A3B8]">
                Nenhuma diferença importante encontrada para este planeta.
              </li>
            )}
          </ul>
        </div>

        <div className="lg:col-span-4 bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl p-6 shadow-xs flex flex-col space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="font-poppins text-sm font-semibold text-[#0F172A] dark:text-[#F0F6FC] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#1E3A8A] dark:text-[#60A5FA]" strokeWidth={1.75} aria-hidden="true" />
              <span>Lugares Mais Parecidos ({activeSample.targetPlanet})</span>
            </h3>
            <span className="text-[11px] text-[#475569] dark:text-[#94A3B8]">Top 5</span>
          </div>

          <div className="space-y-2 flex-1">
            {similarityRanking.slice(0, 5).map(({ site, similarity }) => {
              const isCurrent = site.id === selectedSite.id;
              return (
                <button
                  key={site.id}
                  type="button"
                  onClick={() => onSelectSite(site)}
                  className={`w-full text-left p-2.5 rounded-xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] dark:focus-visible:ring-[#60A5FA] ${
                    isCurrent
                      ? 'bg-[#F1F5F9] dark:bg-[#21262D]'
                      : 'bg-[#F8FAFC] dark:bg-[#0D1117] hover:bg-[#F1F5F9] dark:hover:bg-[#1C2128]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
                    <span className="font-medium text-[#0F172A] dark:text-[#F0F6FC] truncate">
                      {site.name}
                    </span>
                    <span className="font-mono font-semibold text-[#1E3A8A] dark:text-[#60A5FA] tabular-nums shrink-0">
                      {similarity}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#E2E8F0] dark:bg-[#30363D] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1E3A8A] dark:bg-[#3B82F6] rounded-full transition-all duration-200"
                      style={{ width: `${similarity}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
