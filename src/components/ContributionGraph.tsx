import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Award, CalendarDays, Flame, Info } from 'lucide-react';
import {
  buildCalendar,
  CONTRIBUTION_KINDS,
  ContributionDay,
  ContributionEvent,
  ContributionKind,
  eventsInLastYear,
  summarize,
} from '../services/contributions';

/**
 * GitHub-style contribution calendar: one square per day for the last year, darker = more
 * contributions. Sequential single-hue green ramp, validated so adjacent levels stay
 * distinguishable (ΔE ≥ 15) in both themes; low-contrast steps are backed by a per-cell
 * tooltip and a table view.
 */

const LEVEL_CLASSES: Record<ContributionDay['level'], string> = {
  0: 'bg-[#EBEDF0] dark:bg-[#21262D]',
  1: 'bg-[#A7E8B4] dark:bg-[#033A16]',
  2: 'bg-[#4CBB66] dark:bg-[#196C2E]',
  3: 'bg-[#22863A] dark:bg-[#2EA043]',
  4: 'bg-[#0B4F21] dark:bg-[#56D364]',
};

const KIND_ORDER: ContributionKind[] = ['study', 'review', 'endorsement', 'discussion', 'group'];
const WEEKDAY_LABELS = ['', 'Seg', '', 'Qua', '', 'Sex', ''];
const CELL = 11;
const GAP = 3;

const longDate = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
const shortMonth = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString('pt-PT', { month: 'short' }).replace('.', '');

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('pt-PT')} ${n === 1 ? one : many}`;

interface ContributionGraphProps {
  events: ContributionEvent[];
  /** Who the graph belongs to, for accessible labels ("de Ana", "suas"). */
  ownerLabel: string;
  heading?: string;
}

export const ContributionGraph: React.FC<ContributionGraphProps> = ({ events, ownerLabel, heading = 'Contribuições' }) => {
  const today = useMemo(() => new Date(), []);
  const yearEvents = useMemo(() => eventsInLastYear(events, today), [events, today]);
  const weeks = useMemo(() => buildCalendar(yearEvents, today), [yearEvents, today]);
  const summary = useMemo(() => summarize(yearEvents, today), [yearEvents, today]);
  const allTimePoints = useMemo(() => events.reduce((sum, e) => sum + e.points, 0), [events]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<{ day: ContributionDay; left: number; top: number } | null>(null);

  // Like GitHub on small screens: start scrolled to the most recent weeks.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weeks.length]);

  const monthLabels = useMemo(() => {
    const labels: { col: number; text: string }[] = [];
    let lastMonth = '';
    weeks.forEach((week, col) => {
      const month = week[0].date.slice(0, 7);
      if (month !== lastMonth) {
        // Skip a label squeezed into the first partial column.
        if (!(col === 0 && Number(week[0].date.slice(8)) > 24)) labels.push({ col, text: shortMonth(week[0].date) });
        lastMonth = month;
      }
    });
    return labels;
  }, [weeks]);

  const activeDays = useMemo(
    () =>
      weeks
        .flat()
        .filter((d) => d.count > 0)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [weeks]
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, ContributionEvent[]>();
    for (const e of yearEvents) map.set(e.date, [...(map.get(e.date) || []), e]);
    return map;
  }, [yearEvents]);

  const showTooltip = (day: ContributionDay, target: HTMLElement) => {
    const container = scrollRef.current?.parentElement;
    if (!container) return;
    const c = container.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    // Keep the tooltip inside the card near the left/right edges.
    const center = r.left - c.left + r.width / 2;
    const left = Math.min(Math.max(center, 130), Math.max(130, c.width - 130));
    setHovered({ day, left, top: r.top - c.top });
  };

  const gridWidth = weeks.length * (CELL + GAP);

  return (
    <section aria-label={`${heading} de ${ownerLabel}`} className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-poppins text-sm sm:text-base font-bold text-[#0F172A] dark:text-[#F0F6FC] flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-[#22863A] dark:text-[#56D364]" strokeWidth={1.75} aria-hidden="true" />
          <span>{heading}</span>
        </h3>
        <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
          {plural(summary.totalCount, 'contribuição', 'contribuições')} no último ano
        </p>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117]">
          <div className="text-xs text-[#475569] dark:text-[#94A3B8] flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
            Pontos (1 ano)
          </div>
          <div className="font-mono text-2xl font-bold text-[#0F172A] dark:text-[#F0F6FC] tabular-nums mt-0.5">
            {summary.totalPoints.toLocaleString('pt-PT')}
          </div>
          {allTimePoints !== summary.totalPoints && (
            <div className="text-xs text-[#64748B] dark:text-[#8B949E] tabular-nums">
              {allTimePoints.toLocaleString('pt-PT')} no total
            </div>
          )}
        </div>
        <div className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117]">
          <div className="text-xs text-[#475569] dark:text-[#94A3B8]">Contribuições</div>
          <div className="font-mono text-2xl font-bold text-[#0F172A] dark:text-[#F0F6FC] tabular-nums mt-0.5">
            {summary.totalCount.toLocaleString('pt-PT')}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117]">
          <div className="text-xs text-[#475569] dark:text-[#94A3B8]">Dias ativos</div>
          <div className="font-mono text-2xl font-bold text-[#0F172A] dark:text-[#F0F6FC] tabular-nums mt-0.5">
            {summary.activeDays.toLocaleString('pt-PT')}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117]">
          <div className="text-xs text-[#475569] dark:text-[#94A3B8] flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
            Sequência
          </div>
          <div className="font-mono text-2xl font-bold text-[#0F172A] dark:text-[#F0F6FC] tabular-nums mt-0.5">
            {plural(summary.currentStreak, 'dia', 'dias')}
          </div>
          <div className="text-xs text-[#64748B] dark:text-[#8B949E] tabular-nums">
            recorde: {plural(summary.longestStreak, 'dia', 'dias')}
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="relative">
        <div ref={scrollRef} className="overflow-x-auto pb-1" onMouseLeave={() => setHovered(null)}>
          <div className="inline-grid gap-x-2" style={{ gridTemplateColumns: 'auto auto' }}>
            {/* Month labels row (the corner cell masks labels scrolling under the weekday column) */}
            <div aria-hidden="true" className="sticky left-0 z-10 bg-[#FFFFFF] dark:bg-[#161B22]" />
            <div aria-hidden="true" className="relative h-4 text-xs text-[#64748B] dark:text-[#8B949E]" style={{ width: gridWidth }}>
              {monthLabels.map((m) => (
                <span key={`${m.col}-${m.text}`} className="absolute top-0" style={{ left: m.col * (CELL + GAP) }}>
                  {m.text}
                </span>
              ))}
            </div>

            {/* Weekday labels */}
            <div
              aria-hidden="true"
              className="sticky left-0 z-10 grid pr-1 text-xs text-[#64748B] dark:text-[#8B949E] leading-none bg-[#FFFFFF] dark:bg-[#161B22]"
              style={{ gridTemplateRows: `repeat(7, ${CELL}px)`, rowGap: GAP }}
            >
              {WEEKDAY_LABELS.map((label, i) => (
                <span key={i} className="flex items-center">
                  {label}
                </span>
              ))}
            </div>

            {/* Squares */}
            <div
              role="img"
              aria-label={`Calendário de contribuições ${ownerLabel === 'você' ? 'suas' : `de ${ownerLabel}`}: ${plural(summary.totalCount, 'contribuição', 'contribuições')} em ${plural(summary.activeDays, 'dia', 'dias')} no último ano. Detalhe disponível na tabela abaixo.`}
              className="grid grid-flow-col"
              style={{
                gridTemplateRows: `repeat(7, ${CELL}px)`,
                gridAutoColumns: `${CELL}px`,
                gap: GAP,
              }}
            >
              {weeks.flat().map((day) => (
                <div
                  key={day.date}
                  className={`rounded-[2px] ${day.inRange ? LEVEL_CLASSES[day.level] : 'bg-transparent'} ${
                    day.inRange ? 'outline outline-1 -outline-offset-1 outline-[#1B1F23]/[0.06] dark:outline-[#FFFFFF]/[0.05]' : ''
                  }`}
                  onMouseEnter={(e) => day.inRange && showTooltip(day, e.currentTarget)}
                />
              ))}
            </div>
          </div>
        </div>

        {hovered && (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full -mt-2 whitespace-nowrap rounded-lg bg-[#0F172A] dark:bg-[#F0F6FC] px-2.5 py-1.5 text-xs text-[#F8FAFC] dark:text-[#0F172A] shadow-lg"
            style={{ left: hovered.left, top: hovered.top - 6 }}
          >
            <strong className="font-semibold">
              {hovered.day.count === 0 ? 'Sem contribuições' : plural(hovered.day.count, 'contribuição', 'contribuições')}
            </strong>{' '}
            em {longDate(hovered.day.date)}
            {hovered.day.points > 0 && <span className="opacity-80"> · {hovered.day.points} pts</span>}
            {(eventsByDay.get(hovered.day.date) || []).slice(0, 3).map((e, i) => (
              <div key={i} className="opacity-80 max-w-[260px] truncate">
                {CONTRIBUTION_KINDS[e.kind].label}: {e.subject}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end -mt-2">
        <div className="flex items-center gap-1.5 text-xs text-[#64748B] dark:text-[#8B949E]" aria-hidden="true">
          <span>Menos</span>
          {([0, 1, 2, 3, 4] as const).map((level) => (
            <span key={level} className={`inline-block rounded-[2px] ${LEVEL_CLASSES[level]}`} style={{ width: CELL, height: CELL }} />
          ))}
          <span>Mais</span>
        </div>
      </div>

      {/* Breakdown by kind */}
      <div className="flex flex-wrap items-center gap-3">
        <ul className="flex flex-wrap gap-1.5" aria-label="Contribuições por tipo">
          {KIND_ORDER.map((kind) => (
            <li
              key={kind}
              className={`text-xs px-2.5 py-1 rounded-lg tabular-nums ${
                summary.byKind[kind] > 0
                  ? 'bg-[#F1F5F9] dark:bg-[#21262D] text-[#0F172A] dark:text-[#F0F6FC]'
                  : 'bg-[#F8FAFC] dark:bg-[#0D1117] text-[#64748B] dark:text-[#8B949E]'
              }`}
            >
              {CONTRIBUTION_KINDS[kind].plural}: <strong>{summary.byKind[kind]}</strong>
            </li>
          ))}
        </ul>
      </div>

      {summary.totalCount === 0 && (
        <p className="text-sm text-[#475569] dark:text-[#94A3B8] p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0D1117]">
          Ainda sem contribuições registadas no último ano. Publicar estudos, comentar e participar nas conversas dos estudos aparece aqui.
        </p>
      )}

      {/* Recent activity */}
      {yearEvents.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-[#475569] dark:text-[#94A3B8]">Atividade recente</h4>
          <ul className="space-y-1">
            {yearEvents.slice(0, 5).map((e, i) => (
              <li key={`${e.date}-${i}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-x-3 text-sm">
                <span className="min-w-0 truncate text-[#0F172A] dark:text-[#E2E8F0]">
                  <span className="text-[#475569] dark:text-[#94A3B8]">{CONTRIBUTION_KINDS[e.kind].label}:</span> {e.subject}
                </span>
                <span className="sm:shrink-0 text-xs text-[#64748B] dark:text-[#8B949E] tabular-nums">
                  {longDate(e.date)} · +{e.points} pts
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Accessible table view + scoring rules */}
      <div className="flex flex-col sm:flex-row gap-2 text-xs text-[#475569] dark:text-[#94A3B8]">
        {activeDays.length > 0 && (
          <details className="flex-1">
            <summary className="cursor-pointer select-none">Ver como tabela ({plural(activeDays.length, 'dia ativo', 'dias ativos')})</summary>
            <div className="mt-2 max-h-56 overflow-y-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[#64748B] dark:text-[#8B949E]">
                    <th scope="col" className="py-1 pr-3 font-medium">Data</th>
                    <th scope="col" className="py-1 pr-3 font-medium text-right">Contribuições</th>
                    <th scope="col" className="py-1 font-medium text-right">Pontos</th>
                  </tr>
                </thead>
                <tbody>
                  {activeDays.map((d) => (
                    <tr key={d.date} className="border-t border-[#E2E8F0] dark:border-[#30363D] text-[#0F172A] dark:text-[#E2E8F0]">
                      <td className="py-1 pr-3">{longDate(d.date)}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{d.count}</td>
                      <td className="py-1 text-right tabular-nums">{d.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
        <details className="flex-1">
          <summary className="cursor-pointer select-none flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
            Como os pontos são calculados
          </summary>
          <ul className="mt-2 space-y-0.5">
            {KIND_ORDER.map((kind) => (
              <li key={kind} className="flex justify-between gap-3">
                <span>{CONTRIBUTION_KINDS[kind].label}</span>
                <span className="tabular-nums font-medium text-[#0F172A] dark:text-[#E2E8F0]">+{CONTRIBUTION_KINDS[kind].points}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5">Só contam ações com data registada. Mensagens antigas sem data não são contadas.</p>
        </details>
      </div>
    </section>
  );
};
