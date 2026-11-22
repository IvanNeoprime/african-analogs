import type {
  CollaboratorProfile,
  DirectResearchMessage,
  GeologicalSample,
  ResearchNetworkGroup,
} from '../types';

/**
 * Contribution activity (GitHub-style). Only events that really happened and carry a
 * reliable date are counted — nothing is estimated or padded. Older records without a
 * date (e.g. messages saved as "Agora") are simply left out.
 */

export type ContributionKind = 'study' | 'review' | 'endorsement' | 'discussion' | 'group';

export const CONTRIBUTION_KINDS: Record<
  ContributionKind,
  { label: string; plural: string; labelEn: string; pluralEn: string; points: number }
> = {
  study: { label: 'Estudo publicado', plural: 'Estudos publicados', labelEn: 'Published study', pluralEn: 'Published studies', points: 10 },
  review: { label: 'Revisão / comentário', plural: 'Revisões e comentários', labelEn: 'Review / comment', pluralEn: 'Reviews and comments', points: 3 },
  endorsement: { label: 'Endosso de estudo', plural: 'Endossos', labelEn: 'Study endorsement', pluralEn: 'Endorsements', points: 2 },
  discussion: { label: 'Mensagem em estudo', plural: 'Mensagens em estudos', labelEn: 'Message on a study', pluralEn: 'Messages on studies', points: 1 },
  group: { label: 'Grupo criado', plural: 'Grupos criados', labelEn: 'Group created', pluralEn: 'Groups created', points: 5 },
};

export interface ContributionEvent {
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  kind: ContributionKind;
  points: number;
  /** What the contribution was about (study name, group title…). */
  subject: string;
}

export interface ContributionDay {
  date: string;
  count: number;
  points: number;
  level: 0 | 1 | 2 | 3 | 4;
  inRange: boolean;
}

export interface ContributionSummary {
  totalCount: number;
  totalPoints: number;
  byKind: Record<ContributionKind, number>;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function toDayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Accepts ISO strings and "YYYY-MM-DD HH:mm UTC"; returns null for free text like "Agora". */
export function parseDay(value: string | undefined | null): string | null {
  if (!value) return null;
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${mo}-${d}`;
}

const normalize = (s: string) => s.trim().toLowerCase();

/** "Nome (@codename)" or "Nome" → does it belong to this profile? */
function isSameAuthor(authorText: string | undefined, profile: CollaboratorProfile): boolean {
  if (!authorText) return false;
  const text = normalize(authorText);
  return text === normalize(profile.name) || text.startsWith(`${normalize(profile.name)} (`) || text.includes(`(${normalize(profile.codename)})`);
}

export interface ContributionSources {
  samples: GeologicalSample[];
  studyThreads: Record<string, DirectResearchMessage[]>;
  networkGroups: ResearchNetworkGroup[];
}

export function collectContributions(profile: CollaboratorProfile, sources: ContributionSources): ContributionEvent[] {
  const events: ContributionEvent[] = [];
  const push = (date: string | null, kind: ContributionKind, subject: string) => {
    if (date) events.push({ date, kind, points: CONTRIBUTION_KINDS[kind].points, subject });
  };

  for (const sample of sources.samples) {
    const isAuthor = sample.collaboratorId === profile.id || (!sample.collaboratorId && isSameAuthor(sample.collectorName, profile));
    if (isAuthor) {
      push(parseDay(sample.publishedAt) ?? parseDay(sample.collectedAt), 'study', sample.name);
    }

    for (const comment of sample.peerComments || []) {
      const mine = comment.authorId ? comment.authorId === profile.id : isSameAuthor(comment.author, profile);
      if (!mine) continue;
      const day = parseDay(comment.timestamp);
      push(day, 'review', sample.name);
      if (comment.statusChange === 'approved') push(day, 'endorsement', sample.name);
    }
  }

  const sampleNames = new Map(sources.samples.map((s) => [s.id, s.name]));
  for (const [sampleId, thread] of Object.entries(sources.studyThreads)) {
    for (const msg of thread) {
      if (msg.sender !== 'user') continue;
      const mine = msg.senderId ? msg.senderId === profile.id : isSameAuthor(msg.senderName, profile);
      if (mine) push(parseDay(msg.sentAt) ?? parseDay(msg.timestamp), 'discussion', sampleNames.get(sampleId) || 'Estudo');
    }
  }

  for (const group of sources.networkGroups) {
    if (group.createdBy === profile.id) push(parseDay(group.createdAt), 'group', group.title);
  }

  return events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function summarize(events: ContributionEvent[], today: Date = new Date()): ContributionSummary {
  const byKind = { study: 0, review: 0, endorsement: 0, discussion: 0, group: 0 } as Record<ContributionKind, number>;
  const perDay = new Map<string, number>();
  let totalPoints = 0;
  for (const e of events) {
    byKind[e.kind] += 1;
    totalPoints += e.points;
    perDay.set(e.date, (perDay.get(e.date) || 0) + 1);
  }

  // Streaks over consecutive calendar days.
  const days = [...perDay.keys()].sort();
  let longest = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of days) {
    const d = new Date(`${key}T12:00:00`);
    run = prev && Math.round((d.getTime() - prev.getTime()) / 86_400_000) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  let current = 0;
  const cursor = new Date(today);
  // A streak still counts if the last contribution was today or yesterday.
  if (!perDay.has(toDayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (perDay.has(toDayKey(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    totalCount: events.length,
    totalPoints,
    byKind,
    activeDays: perDay.size,
    currentStreak: current,
    longestStreak: longest,
  };
}

/** Intensity level like GitHub: 0 = none, 1–4 = increasing activity. */
export function levelFor(count: number): ContributionDay['level'] {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

/**
 * Builds a Sunday-first grid of `weeks` columns ending in the week of `today`
 * (GitHub layout). Days after today are marked out of range.
 */
export function buildCalendar(events: ContributionEvent[], today: Date = new Date(), weeks = 53): ContributionDay[][] {
  const counts = new Map<string, { count: number; points: number }>();
  for (const e of events) {
    const c = counts.get(e.date) || { count: 0, points: 0 };
    c.count += 1;
    c.points += e.points;
    counts.set(e.date, c);
  }

  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - end.getDay() - (weeks - 1) * 7);
  const todayKey = toDayKey(end);

  const grid: ContributionDay[][] = [];
  const cursor = new Date(start);
  for (let w = 0; w < weeks; w++) {
    const column: ContributionDay[] = [];
    for (let d = 0; d < 7; d++) {
      const key = toDayKey(cursor);
      const c = counts.get(key);
      column.push({
        date: key,
        count: c?.count || 0,
        points: c?.points || 0,
        level: levelFor(c?.count || 0),
        inRange: key <= todayKey,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    grid.push(column);
  }
  return grid;
}

/** Events inside the calendar window only (the graph shows the last year). */
export function eventsInLastYear(events: ContributionEvent[], today: Date = new Date(), weeks = 53): ContributionEvent[] {
  const first = buildCalendar([], today, weeks)[0][0].date;
  const last = toDayKey(today);
  return events.filter((e) => e.date >= first && e.date <= last);
}
