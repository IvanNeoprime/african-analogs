import React, { useEffect, useMemo, useState } from 'react';
import {
  buildNasaImagesSearchUrl,
  buildNasaOpenDataSearchUrl,
  buildNasaWorldviewUrl,
  downloadNasaCsvTemplate,
  NASA_DATA_SHORTCUTS,
  NasaShortcutCategory,
} from '../services/officialApis';
import { AnalogueSite, PlanetaryTarget } from '../types';
import { getCelestialBodyFullLabel } from '../data/celestialBodies';
import {
  Camera,
  Database,
  Download,
  ExternalLink,
  Flame,
  Globe2,
  Satellite,
  Search,
  X,
} from 'lucide-react';

export type NasaShortcutFilter = 'all' | NasaShortcutCategory;

interface NasaDataShortcutsModalProps {
  isOpen: boolean;
  initialCategory?: NasaShortcutFilter;
  selectedSite: AnalogueSite;
  currentCoords: { lat: number; lng: number } | null;
  targetPlanet: PlanetaryTarget;
  onClose: () => void;
  onActivateNasaEventsOnMap: () => void;
}


export const NasaDataShortcutsModal: React.FC<NasaDataShortcutsModalProps> = ({
  isOpen,
  initialCategory = 'all',
  selectedSite,
  currentCoords,
  targetPlanet,
  onClose,
  onActivateNasaEventsOnMap,
}) => {
  const [category, setCategory] = useState<NasaShortcutFilter>(initialCategory);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCategory(initialCategory);
      setQuery('');
    }
  }, [isOpen, initialCategory]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredShortcuts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return NASA_DATA_SHORTCUTS.filter((item) => {
      const catOk = category === 'all' || item.category === category;
      if (!catOk) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.provider.toLowerCase().includes(q) ||
        item.formats.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.howToUseHere.toLowerCase().includes(q)
      );
    });
  }, [category, query]);

  if (!isOpen) return null;

  const activeLat = currentCoords?.lat ?? selectedSite.coordinates[0];
  const activeLng = currentCoords?.lng ?? selectedSite.coordinates[1];
  const worldviewUrl = buildNasaWorldviewUrl(activeLat, activeLng);
  const nasaImagesUrl = buildNasaImagesSearchUrl(targetPlanet);
  const nasaOpenDataUrl = buildNasaOpenDataSearchUrl(targetPlanet);
  const planetLabel = getCelestialBodyFullLabel(targetPlanet);

  const filterButtons: { id: NasaShortcutFilter; label: string }[] = [
    { id: 'all', label: 'Todos os Portais' },
    { id: 'datasets', label: 'Planilhas & Minerais' },
    { id: 'imagery', label: 'Fotos & Satélite (GeoTIFF)' },
    { id: 'missions', label: 'Marte, Lua & Sondas' },
  ];

  return (
    <div
      className="fixed inset-0 z-[1000] bg-[#0F172A]/60 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="nasa-shortcuts-title"
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] bg-[#FFFFFF] dark:bg-[#161B22] rounded-2xl shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-[#F8FAFC] dark:bg-[#0D1117] flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#1E3A8A] dark:text-[#60A5FA]">
              <Satellite className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
              <span>Fontes Públicas Oficiais</span>
            </div>
            <h2
              id="nasa-shortcuts-title"
              className="font-poppins text-lg sm:text-xl font-bold text-[#0F172A] dark:text-[#F0F6FC]"
            >
              Onde Encontrar Dados da NASA
            </h2>
            <p className="text-xs sm:text-sm text-[#475569] dark:text-[#94A3B8] leading-relaxed">
              Sem arquivo, planilha ou foto própria no momento? Use estes atalhos gratuitos da NASA para baixar dados reais ou consultar a região atual.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar atalhos da NASA"
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-[#FFFFFF] dark:bg-[#161B22] text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F0F6FC] shadow-xs cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
          {/* Contextual Quick Shortcuts for Active Location & Target Planet */}
          <div className="p-4 rounded-xl bg-[#F1F5F9] dark:bg-[#0D1117] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold text-[#0F172A] dark:text-[#F0F6FC]">
                Atalhos diretos para sua pesquisa atual ({selectedSite.name.split(' (')[0]} · {planetLabel})
              </div>
              <span className="text-[11px] font-mono text-[#475569] dark:text-[#94A3B8] tabular-nums">
                {activeLat.toFixed(2)}°, {activeLng.toFixed(2)}°
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href={worldviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[36px] py-1.5 px-3 bg-[#FFFFFF] dark:bg-[#161B22] hover:bg-[#E2E8F0] dark:hover:bg-[#21262D] text-[#0F172A] dark:text-[#F0F6FC] text-xs font-medium rounded-xl inline-flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Globe2 className="w-3.5 h-3.5 text-[#1E3A8A] dark:text-[#60A5FA]" strokeWidth={1.75} aria-hidden="true" />
                <span>Ver esta região no NASA Worldview</span>
                <ExternalLink className="w-3 h-3 opacity-70" aria-hidden="true" />
              </a>

              <a
                href={nasaImagesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[36px] py-1.5 px-3 bg-[#FFFFFF] dark:bg-[#161B22] hover:bg-[#E2E8F0] dark:hover:bg-[#21262D] text-[#0F172A] dark:text-[#F0F6FC] text-xs font-medium rounded-xl inline-flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Camera className="w-3.5 h-3.5 text-[#1E3A8A] dark:text-[#60A5FA]" strokeWidth={1.75} aria-hidden="true" />
                <span>Fotos NASA de {planetLabel}</span>
                <ExternalLink className="w-3 h-3 opacity-70" aria-hidden="true" />
              </a>

              <a
                href={nasaOpenDataUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[36px] py-1.5 px-3 bg-[#FFFFFF] dark:bg-[#161B22] hover:bg-[#E2E8F0] dark:hover:bg-[#21262D] text-[#0F172A] dark:text-[#F0F6FC] text-xs font-medium rounded-xl inline-flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Database className="w-3.5 h-3.5 text-[#1E3A8A] dark:text-[#60A5FA]" strokeWidth={1.75} aria-hidden="true" />
                <span>Datasets de {planetLabel} (NASA Data)</span>
                <ExternalLink className="w-3 h-3 opacity-70" aria-hidden="true" />
              </a>

              <button
                type="button"
                onClick={() => {
                  onActivateNasaEventsOnMap();
                  onClose();
                }}
                className="min-h-[36px] py-1.5 px-3 bg-[#D97706] hover:bg-[#B45309] text-[#FFFFFF] text-xs font-medium rounded-xl inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Flame className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                <span>Ver Eventos NASA no Mapa</span>
              </button>

              <button
                type="button"
                onClick={downloadNasaCsvTemplate}
                className="min-h-[36px] py-1.5 px-3 bg-[#1E3A8A] dark:bg-[#2563EB] hover:bg-[#1E40AF] dark:hover:bg-[#1D4ED8] text-[#FFFFFF] text-xs font-medium rounded-xl inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                <span>Baixar Modelo CSV</span>
              </button>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrar fontes da NASA">
              {filterButtons.map((btn) => {
                const active = category === btn.id;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setCategory(btn.id)}
                    className={`py-1.5 px-3 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#1E3A8A] dark:bg-[#2563EB] text-[#FFFFFF]'
                        : 'bg-[#F1F5F9] dark:bg-[#0D1117] text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F0F6FC]'
                    }`}
                  >
                    {btn.label}
                  </button>
                );
              })}
            </div>

            <div className="relative w-full sm:w-60 shrink-0">
              <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Filtrar portais da NASA"
                placeholder="Ex.: GeoTIFF, rover, CSV..."
                className="w-full bg-[#F1F5F9] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#F0F6FC] placeholder:text-[#94A3B8] text-xs pl-8 pr-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
              />
            </div>
          </div>

          {/* Portal Grid */}
          {filteredShortcuts.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117] text-xs text-[#475569] dark:text-[#94A3B8]">
              Nenhuma fonte da NASA encontrada para "{query}". Tente limpar a busca ou escolher outro filtro.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredShortcuts.map((source) => (
                <div
                  key={source.id}
                  className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117] flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-medium text-[#475569] dark:text-[#94A3B8]">
                          {source.provider}
                        </div>
                        <h3 className="font-poppins text-sm font-bold text-[#0F172A] dark:text-[#F0F6FC] mt-0.5">
                          {source.title}
                        </h3>
                      </div>
                      <span className="shrink-0 text-[10px] font-medium bg-[#FFFFFF] dark:bg-[#161B22] text-[#1E3A8A] dark:text-[#60A5FA] px-2 py-1 rounded-lg shadow-xs">
                        {source.formats}
                      </span>
                    </div>

                    <p className="text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                      {source.description}
                    </p>

                    <div className="text-[11px] text-[#0F766E] dark:text-[#2DD4BF] bg-[#FFFFFF] dark:bg-[#161B22] px-2.5 py-2 rounded-lg">
                      <strong>Como usar aqui:</strong> {source.howToUseHere}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[36px] py-1.5 px-3.5 bg-[#FFFFFF] dark:bg-[#161B22] hover:bg-[#1E3A8A] dark:hover:bg-[#2563EB] text-[#1E3A8A] dark:text-[#60A5FA] hover:text-[#FFFFFF] dark:hover:text-[#FFFFFF] text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <span>Abrir Portal NASA</span>
                      <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
