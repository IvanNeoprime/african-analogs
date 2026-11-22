import { getMineralLabel, getSiteText } from '../data/siteTranslations';
import { getLocale, tr, useI18n } from '../i18n';
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { Calendar, ChevronLeft, ChevronRight, Layers, Maximize2, Minimize2, Pause, Play } from 'lucide-react';
import { AnalogueSite, PlanetaryTarget } from '../types';
import { getCelestialBodyLabel } from '../data/celestialBodies';
import { fetchOfficialElevation, NasaEonetEventItem } from '../services/officialApis';

export interface InteractiveSiteMapHandle {
  flyTo: (coords: [number, number], zoom?: number) => void;
}

export interface MapPickedPoint {
  lat: number;
  lng: number;
  elevationMeters: number | null;
  nearestSite: AnalogueSite | null;
  nearestDistanceKm: number | null;
}

interface InteractiveSiteMapProps {
  /** Sites visible after the parent's filters. */
  sites: AnalogueSite[];
  /** Full catalogue, used to find the nearest analogue to a clicked point. */
  allSites: AnalogueSite[];
  selectedSite: AnalogueSite;
  onSelectSite: (site: AnalogueSite) => void;
  showNasaEvents: boolean;
  nasaEvents: NasaEonetEventItem[];
  userLocation: { lat: number; lng: number; accuracy: number | null } | null;
  onUsePoint: (point: MapPickedPoint) => void;
}

type BaseLayerId = 'topo' | 'satellite_hd' | 'gibs_daily';

const BASE_LAYERS: { id: BaseLayerId; label: string }[] = [
  { id: 'topo', label: 'Relevo' },
  { id: 'satellite_hd', label: 'Satélite HD' },
  { id: 'gibs_daily', label: 'NASA diário' },
];

const BODY_COLORS: Partial<Record<PlanetaryTarget, string>> = {
  Mars: '#DC2626',
  Moon: '#64748B',
  Venus: '#D97706',
  Mercury: '#78716C',
  Europa: '#0284C7',
  Enceladus: '#0891B2',
  Titan: '#A16207',
  Io: '#CA8A04',
  Both: '#7C3AED',
  Earth: '#15803D',
};
const DEFAULT_BODY_COLOR = '#1E3A8A';

const EVENT_COLORS: { match: RegExp; color: string }[] = [
  { match: /wildfire|fire/i, color: '#DC2626' },
  { match: /volcano/i, color: '#EA580C' },
  { match: /storm|cyclone/i, color: '#7C3AED' },
  { match: /dust|haze/i, color: '#A16207' },
  { match: /ice|snow/i, color: '#0891B2' },
  { match: /flood/i, color: '#2563EB' },
];

const bodyColor = (target: PlanetaryTarget) => BODY_COLORS[target] || DEFAULT_BODY_COLOR;
const bodyName = (target: PlanetaryTarget) => getCelestialBodyLabel(target);
const eventColor = (category: string) => EVENT_COLORS.find((e) => e.match.test(category))?.color || '#D97706';

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function shiftIsoDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// MODIS Terra began delivering imagery in Feb 2000; GIBS usually lags one day behind.
const GIBS_MIN_DATE = '2000-03-01';

function createBaseLayer(id: BaseLayerId, gibsDate: string): L.TileLayer {
  switch (id) {
    case 'satellite_hd':
      return L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxNativeZoom: 18,
          maxZoom: 18,
          attribution: 'Imagens &copy; Esri, Maxar, Earthstar Geographics',
        }
      );
    case 'gibs_daily':
      return L.tileLayer(
        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${gibsDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
        {
          maxNativeZoom: 9,
          maxZoom: 18,
          attribution: `NASA GIBS · MODIS Terra ${gibsDate}`,
        }
      );
    case 'topo':
    default:
      return L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        subdomains: 'abc',
        maxNativeZoom: 17,
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap, SRTM · OpenTopoMap (CC-BY-SA)',
      });
  }
}

function siteIcon(site: AnalogueSite, isSelected: boolean): L.DivIcon {
  const color = bodyColor(site.targetPlanet);
  const size = isSelected ? 32 : 24;
  const label = escapeHtml(bodyName(site.targetPlanet).slice(0, 2));
  return L.divIcon({
    className: 'aa-site-pin',
    html: `<div class="aa-pin ${isSelected ? 'aa-pin--selected' : ''}" style="--pin-color:${color};width:${size}px;height:${size}px;">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function sitePopupHtml(site: AnalogueSite): string {
  const minerals = site.primaryMinerals.slice(0, 3).map((mineral) => escapeHtml(getMineralLabel(mineral))).join(', ');
  return `
    <div class="aa-popup">
      <div class="aa-popup__eyebrow" style="color:${bodyColor(site.targetPlanet)}">${tr("Parecido com", "Similar to")} ${escapeHtml(bodyName(site.targetPlanet))}</div>
      <div class="aa-popup__title">${escapeHtml(getSiteText(site, 'name'))}</div>
      <div class="aa-popup__meta">${escapeHtml(getSiteText(site, 'country'))} · ${escapeHtml(getSiteText(site, 'region'))}</div>
      <table class="aa-popup__table">
        <tr><td>{t("${tr("Semelhança (est.)", "Similarity (est.)")}", "Similarity (est.)")}</td><td>${escapeHtml(site.fidelityScore)}%</td></tr>
        <tr><td>Altitude</td><td>${escapeHtml(site.elevationMeters)} m</td></tr>
        <tr><td>${tr("Coordenadas", "Coordinates")}</td><td>${site.coordinates[0].toFixed(3)}°, ${site.coordinates[1].toFixed(3)}°</td></tr>
        ${minerals ? `<tr><td>${tr("Minerais", "Minerals")}</td><td>${minerals}</td></tr>` : ''}
      </table>
      ${
        site.references?.[0]
          ? `<a class="aa-popup__ref" href="${escapeHtml(site.references[0].url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(site.references[0].citation.split('(')[0].trim())} (${escapeHtml(site.references[0].citation.match(/\((\d{4})\)/)?.[1] || '')}) ↗</a>`
          : ''
      }
    </div>`;
}

export const InteractiveSiteMap = forwardRef<InteractiveSiteMapHandle, InteractiveSiteMapProps>(
  ({ sites, allSites, selectedSite, onSelectSite, showNasaEvents, nasaEvents, userLocation, onUsePoint }, ref) => {
    const { t, lang } = useI18n();
    const rootRef = useRef<HTMLDivElement>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const baseLayerRef = useRef<L.TileLayer | null>(null);
    const sitesLayerRef = useRef<L.LayerGroup | null>(null);
    const eventsLayerRef = useRef<L.LayerGroup | null>(null);
    const userLayerRef = useRef<L.LayerGroup | null>(null);
    const cursorReadoutRef = useRef<HTMLDivElement>(null);
    const siteMarkersRef = useRef<Map<string, L.Marker>>(new Map());

    // Keep the latest callbacks/data reachable from Leaflet handlers registered once.
    const latest = useRef({ onSelectSite, onUsePoint, allSites });
    latest.current = { onSelectSite, onUsePoint, allSites };

    const [baseLayer, setBaseLayer] = useState<BaseLayerId>('topo');
    const [gibsDate, setGibsDate] = useState(() => isoDaysAgo(2));
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isTouring, setIsTouring] = useState(false);
    const gibsMaxDate = useMemo(() => isoDaysAgo(1), []);

    useImperativeHandle(ref, () => ({
      flyTo: (coords, zoom = 6) => mapRef.current?.flyTo(coords, zoom, { duration: 0.9 }),
    }));

    // --- Map initialisation (once) ---
    useEffect(() => {
      if (!mapContainerRef.current || mapRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: selectedSite.coordinates,
        zoom: 3,
        minZoom: 2,
        maxZoom: 18,
        worldCopyJump: true,
        zoomControl: true,
      });
      map.attributionControl.setPrefix(false);
      L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);

      sitesLayerRef.current = L.layerGroup().addTo(map);
      eventsLayerRef.current = L.layerGroup().addTo(map);
      userLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;

      // Live cursor coordinates, written straight to the DOM to avoid re-rendering on every mouse move.
      let frame = 0;
      map.on('mousemove', (e: L.LeafletMouseEvent) => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          if (cursorReadoutRef.current) {
            cursorReadoutRef.current.textContent = `${e.latlng.lat.toFixed(4)}°, ${e.latlng.wrap().lng.toFixed(4)}°`;
          }
        });
      });
      map.on('mouseout', () => {
        if (cursorReadoutRef.current) cursorReadoutRef.current.textContent = window.matchMedia('(hover: hover)').matches ? 'Passe o cursor ou clique no mapa' : 'Toque no mapa para analisar um ponto';
      });

      // Click anywhere: inspect the point (SRTM elevation + nearest analogue).
      map.on('click', (e: L.LeafletMouseEvent) => {
        const lat = parseFloat(e.latlng.lat.toFixed(5));
        const lng = parseFloat(e.latlng.wrap().lng.toFixed(5));
        const { allSites: catalogue } = latest.current;

        let nearestSite: AnalogueSite | null = null;
        let nearestDistanceKm: number | null = null;
        for (const s of catalogue) {
          const d = haversineKm([lat, lng], s.coordinates);
          if (nearestDistanceKm === null || d < nearestDistanceKm) {
            nearestDistanceKm = d;
            nearestSite = s;
          }
        }

        const point: MapPickedPoint = { lat, lng, elevationMeters: null, nearestSite, nearestDistanceKm };

        const el = L.DomUtil.create('div', 'aa-popup');
        el.innerHTML = `
          <div class="aa-popup__eyebrow">${tr("Ponto selecionado", "Selected point")}</div>
          <div class="aa-popup__title aa-mono">${lat.toFixed(4)}°, ${lng.toFixed(4)}°</div>
          <table class="aa-popup__table">
            <tr><td>Altitude SRTM</td><td data-role="elev">${tr("a consultar…", "loading…")}</td></tr>
            ${
              nearestSite
                ? `<tr><td>${tr("Análogo mais próximo", "Nearest analogue")}</td><td>${escapeHtml(getSiteText(nearestSite, 'name'))} (${Math.round(nearestDistanceKm!).toLocaleString(getLocale())} km)</td></tr>`
                : ''
            }
          </table>
          <div class="aa-popup__actions">
            <button type="button" data-role="use" class="aa-btn aa-btn--primary">${tr("Usar este ponto na análise", "Use this point in the analysis")}</button>
            ${nearestSite ? `<button type="button" data-role="nearest" class="aa-btn">${tr("Ir ao análogo", "Go to analogue")}</button>` : ''}
          </div>`;

        L.DomEvent.disableClickPropagation(el);
        el.querySelector<HTMLButtonElement>('[data-role="use"]')?.addEventListener('click', () => {
          latest.current.onUsePoint({ ...point });
          map.closePopup();
        });
        el.querySelector<HTMLButtonElement>('[data-role="nearest"]')?.addEventListener('click', () => {
          if (!nearestSite) return;
          latest.current.onSelectSite(nearestSite);
          map.closePopup();
          map.flyTo(nearestSite.coordinates, 6, { duration: 1.1 });
        });

        L.popup({ maxWidth: 300 }).setLatLng(e.latlng).setContent(el).openOn(map);

        fetchOfficialElevation(lat, lng).then((dem) => {
          point.elevationMeters = dem.elevationMeters;
          const cell = el.querySelector('[data-role="elev"]');
          if (cell) cell.textContent = dem.elevationMeters !== null ? `${dem.elevationMeters} m` : tr('indisponível', 'unavailable');
        });
      });

      // Dragging the map manually stops the automatic tour.
      map.on('dragstart', () => setIsTouring(false));

      // Keep tiles correct when the container resizes (fullscreen, layout changes).
      const observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(mapContainerRef.current);

      // Initial view: frame every site.
      if (latest.current.allSites.length > 1) {
        map.fitBounds(L.latLngBounds(latest.current.allSites.map((s) => s.coordinates)), { padding: [30, 30], maxZoom: 5 });
      }

      return () => {
        observer.disconnect();
        cancelAnimationFrame(frame);
        map.remove();
        mapRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --- Base layer / GIBS date ---
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;
      if (baseLayerRef.current) map.removeLayer(baseLayerRef.current);
      const layer = createBaseLayer(baseLayer, gibsDate).addTo(map);
      layer.bringToBack();
      baseLayerRef.current = layer;
    }, [baseLayer, gibsDate]);

    // --- Site markers ---
    useEffect(() => {
      const layer = sitesLayerRef.current;
      const map = mapRef.current;
      if (!layer || !map) return;

      layer.clearLayers();
      siteMarkersRef.current.clear();

      sites.forEach((site) => {
        const isSelected = site.id === selectedSite.id;
        const marker = L.marker(site.coordinates, {
          icon: siteIcon(site, isSelected),
          zIndexOffset: isSelected ? 1000 : 0,
          riseOnHover: true,
          keyboard: true,
          title: site.name,
        });
        marker.bindTooltip(
          `<strong>${escapeHtml(getSiteText(site, 'name'))}</strong><br/><span class="aa-mono">${escapeHtml(bodyName(site.targetPlanet))} · ${escapeHtml(site.fidelityScore)}%</span>`,
          { direction: 'top', offset: [0, -10] }
        );
        marker.bindPopup(sitePopupHtml(site), { maxWidth: 300 });
        marker.on('click', () => {
          setIsTouring(false);
          latest.current.onSelectSite(site);
          map.flyTo(site.coordinates, Math.max(map.getZoom(), 6), { duration: 0.9 });
        });
        layer.addLayer(marker);
        siteMarkersRef.current.set(site.id, marker);
      });
    }, [sites, selectedSite.id, lang]);

    // --- Re-frame the map when the filter changes the visible set ---
    const sitesKey = sites.map((s) => s.id).join('|');
    const firstFrameRef = useRef(true);
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;
      if (firstFrameRef.current) {
        firstFrameRef.current = false;
        return;
      }
      if (sites.length === 1) {
        map.flyTo(sites[0].coordinates, 6, { duration: 0.9 });
      } else if (sites.length > 1) {
        map.flyToBounds(L.latLngBounds(sites.map((s) => s.coordinates)), { padding: [40, 40], maxZoom: 6, duration: 0.9 });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sitesKey]);

    // --- NASA EONET events ---
    useEffect(() => {
      const layer = eventsLayerRef.current;
      if (!layer) return;
      layer.clearLayers();
      if (!showNasaEvents) return;

      nasaEvents.forEach((ev) => {
        if (!ev.coordinates) return;
        const color = eventColor(ev.category);
        const marker = L.circleMarker(ev.coordinates, {
          radius: 7,
          color: '#FFFFFF',
          weight: 2,
          fillColor: color,
          fillOpacity: 0.9,
          className: 'aa-event-dot',
        });
        marker.bindTooltip(`<strong>${escapeHtml(ev.title)}</strong>`, { direction: 'top' });
        marker.bindPopup(
          `<div class="aa-popup">
             <div class="aa-popup__eyebrow" style="color:${color}">NASA EONET · ${escapeHtml(ev.category)}</div>
             <div class="aa-popup__title">${escapeHtml(ev.title)}</div>
             <div class="aa-popup__meta">${ev.date ? `${tr("Última observação", "Last observation")}: ${escapeHtml(ev.date)}` : ''}</div>
             <div class="aa-popup__meta aa-mono">${ev.coordinates[0].toFixed(3)}°, ${ev.coordinates[1].toFixed(3)}°</div>
           </div>`,
          { maxWidth: 280 }
        );
        layer.addLayer(marker);
      });
    }, [showNasaEvents, nasaEvents, lang]);

    // --- User GPS location ---
    useEffect(() => {
      const layer = userLayerRef.current;
      if (!layer) return;
      layer.clearLayers();
      if (!userLocation) return;
      const latlng: [number, number] = [userLocation.lat, userLocation.lng];
      if (userLocation.accuracy && userLocation.accuracy > 0) {
        L.circle(latlng, {
          radius: userLocation.accuracy,
          color: '#2563EB',
          weight: 1,
          fillColor: '#2563EB',
          fillOpacity: 0.12,
          interactive: false,
        }).addTo(layer);
      }
      L.marker(latlng, {
        icon: L.divIcon({ className: 'aa-user-pin', html: '<div class="aa-user-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
        zIndexOffset: 2000,
      })
        .bindTooltip(tr('Local de análise', 'Analysis location'), { direction: 'top' })
        .addTo(layer);
    }, [userLocation?.lat, userLocation?.lng, userLocation?.accuracy, lang]);

    // --- Guided tour through the visible sites ---
    useEffect(() => {
      if (!isTouring || sites.length === 0) return;
      let index = Math.max(0, sites.findIndex((s) => s.id === selectedSite.id));
      const step = () => {
        index = (index + 1) % sites.length;
        const site = sites[index];
        latest.current.onSelectSite(site);
        mapRef.current?.flyTo(site.coordinates, 6, { duration: 2 });
        window.setTimeout(() => siteMarkersRef.current.get(site.id)?.openPopup(), 2100);
      };
      step();
      const timer = window.setInterval(step, 5000);
      return () => window.clearInterval(timer);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isTouring, sitesKey]);

    // --- Fullscreen: Esc to leave, lock page scroll ---
    useEffect(() => {
      if (!isFullscreen) return;
      const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsFullscreen(false);
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', onKey);
      return () => {
        window.removeEventListener('keydown', onKey);
        document.body.style.overflow = previousOverflow;
      };
    }, [isFullscreen]);

    const bodiesOnMap = useMemo(() => {
      const seen = new Map<PlanetaryTarget, number>();
      sites.forEach((s) => seen.set(s.targetPlanet, (seen.get(s.targetPlanet) || 0) + 1));
      return Array.from(seen.entries());
    }, [sites]);

    const controlBtn =
      'h-8 px-2.5 text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors';
    const controlIdle =
      'bg-[#FFFFFF]/95 dark:bg-[#161B22]/95 text-[#334155] dark:text-[#C9D1D9] hover:text-[#0F172A] dark:hover:text-[#F0F6FC] shadow-sm';
    const controlActive = 'bg-[#1E3A8A] dark:bg-[#2563EB] text-[#FFFFFF] shadow-sm';

    return (
      <>
        {isFullscreen && (
          <div className="fixed inset-0 z-[1190] bg-[#0F172A]/60" aria-hidden="true" onClick={() => setIsFullscreen(false)} />
        )}
        {/* Placeholder keeps the card's layout stable while the map is in fullscreen. */}
        <div className="relative w-full flex-1 min-h-[380px]">
        <div
          ref={rootRef}
          className={
            isFullscreen
              ? 'fixed inset-3 sm:inset-6 z-[1200] rounded-2xl overflow-hidden shadow-2xl'
              : 'absolute inset-0 rounded-xl overflow-hidden'
          }
        >
          <div
            ref={mapContainerRef}
            className="absolute inset-0 z-0"
            role="application"
            aria-label={t("Mapa interativo de lugares estudados. Clique num ponto para ver altitude e o análogo mais próximo.", "Interactive map of studied sites. Select a point to see its elevation and nearest analogue.")}
          />

          {/* Top-left: base layer switcher + GIBS date */}
          <div className="absolute top-3 left-14 z-10 flex flex-wrap items-center gap-1.5 max-w-[calc(100%-7rem)]">
            {/* Phones: one compact menu instead of three buttons (they collided with Tour/fullscreen). */}
            <label className="sm:hidden flex items-center gap-1 bg-[#FFFFFF]/95 dark:bg-[#161B22]/95 pl-2 pr-1 rounded-xl shadow-sm">
              <Layers className="w-3.5 h-3.5 text-[#64748B]" strokeWidth={1.75} aria-hidden="true" />
              <span className="sr-only">{t("Tipo de mapa", "Map type")}</span>
              <select
                value={baseLayer}
                onChange={(e) => setBaseLayer(e.target.value as BaseLayerId)}
                className="h-9 bg-transparent text-xs font-medium text-[#0F172A] dark:text-[#F0F6FC] focus:outline-none cursor-pointer"
              >
                {BASE_LAYERS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {t(l.label, l.id === "satellite_hd" ? "HD Satellite" : l.id === "gibs_daily" ? "NASA Daily" : l.label)}
                  </option>
                ))}
              </select>
            </label>
            <div className="hidden sm:flex items-center gap-1 bg-[#FFFFFF]/95 dark:bg-[#161B22]/95 p-1 rounded-xl shadow-sm">
              <Layers className="w-3.5 h-3.5 mx-1 text-[#64748B]" strokeWidth={1.75} aria-hidden="true" />
              {BASE_LAYERS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  aria-pressed={baseLayer === l.id}
                  onClick={() => setBaseLayer(l.id)}
                  className={`h-7 px-2.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
                    baseLayer === l.id ? controlActive : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F0F6FC]'
                  }`}
                >
                  {t(l.label, l.id === "satellite_hd" ? "HD Satellite" : l.id === "gibs_daily" ? "NASA Daily" : l.label)}
                </button>
              ))}
            </div>

            {baseLayer === 'gibs_daily' && (
              <div className="flex items-center gap-0.5 bg-[#FFFFFF]/95 dark:bg-[#161B22]/95 p-1 rounded-xl shadow-sm">
                <button
                  type="button"
                  aria-label="Dia anterior"
                  onClick={() => setGibsDate((d) => (d > GIBS_MIN_DATE ? shiftIsoDate(d, -1) : d))}
                  className="h-7 w-7 flex items-center justify-center rounded-lg text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#21262D] cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <label className="flex items-center gap-1 px-1">
                  <Calendar className="w-3.5 h-3.5 text-[#64748B]" strokeWidth={1.75} aria-hidden="true" />
                  <span className="sr-only">{t("Data da imagem NASA", "NASA image date")}</span>
                  <input
                    type="date"
                    value={gibsDate}
                    min={GIBS_MIN_DATE}
                    max={gibsMaxDate}
                    onChange={(e) => e.target.value && setGibsDate(e.target.value)}
                    className="bg-transparent text-xs font-mono text-[#0F172A] dark:text-[#F0F6FC] focus:outline-none"
                  />
                </label>
                <button
                  type="button"
                  aria-label="Dia seguinte"
                  onClick={() => setGibsDate((d) => (d < gibsMaxDate ? shiftIsoDate(d, 1) : d))}
                  className="h-7 w-7 flex items-center justify-center rounded-lg text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#21262D] cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>
            )}
          </div>

          {/* Top-right: tour + fullscreen */}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
            <button
              type="button"
              aria-pressed={isTouring}
              onClick={() => setIsTouring((t) => !t)}
              disabled={sites.length < 2}
              className={`${controlBtn} ${isTouring ? controlActive : controlIdle} disabled:opacity-50 disabled:cursor-not-allowed`}
              title={t("Percorrer automaticamente os lugares visíveis", "Automatically cycle through visible sites")}
            >
              {isTouring ? <Pause className="w-3.5 h-3.5" strokeWidth={1.75} /> : <Play className="w-3.5 h-3.5" strokeWidth={1.75} />}
              <span className="hidden sm:inline">{isTouring ? 'Parar tour' : 'Tour'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreen((f) => !f)}
              className={`${controlBtn} ${controlIdle}`}
              aria-label={isFullscreen ? t("Sair de ecrã inteiro", "Exit full screen") : t("Ecrã inteiro", "Full screen")}
              title={isFullscreen ? t("Sair de ecrã inteiro (Esc)", "Exit full screen (Esc)") : t("Ecrã inteiro", "Full screen")}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" strokeWidth={1.75} /> : <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.75} />}
            </button>
          </div>

          {/* Bottom-left: legend + live cursor coordinates */}
          <div className="absolute bottom-6 left-3 z-10 flex flex-col items-start gap-1.5 pointer-events-none max-w-[calc(100%-8rem)]">
            {bodiesOnMap.length > 0 && (
              <div className="flex flex-wrap gap-x-2.5 gap-y-1 bg-[#FFFFFF]/95 dark:bg-[#161B22]/95 px-2.5 py-1.5 rounded-lg shadow-sm text-[11px] text-[#334155] dark:text-[#C9D1D9]">
                {bodiesOnMap.map(([target, count]) => (
                  <span key={target} className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: bodyColor(target) }} aria-hidden="true" />
                    {bodyName(target)} <span className="opacity-60 tabular-nums">{count}</span>
                  </span>
                ))}
                {showNasaEvents && nasaEvents.length > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#D97706] ring-2 ring-white" aria-hidden="true" />
                    {t("Eventos NASA", "NASA Events")} <span className="opacity-60 tabular-nums">{nasaEvents.filter((e) => e.coordinates).length}</span>
                  </span>
                )}
              </div>
            )}
            <div
              ref={cursorReadoutRef}
              className="bg-[#0F172A]/80 text-[#F8FAFC] font-mono text-[11px] px-2 py-1 rounded-md tabular-nums"
              aria-live="off"
            >
              <span className="hidden [@media(hover:hover)]:inline">{t("Passe o cursor ou clique no mapa", "Hover or click on the map")}</span>
              <span className="[@media(hover:hover)]:hidden">{t("Toque no mapa para analisar um ponto", "Tap the map to analyse a point")}</span>
            </div>
          </div>
        </div>
        </div>
      </>
    );
  }
);

InteractiveSiteMap.displayName = 'InteractiveSiteMap';
