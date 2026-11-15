import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CollaboratorProfile, GeologicalSample } from '../types';
import { buildCalendar, collectContributions, levelFor, parseDay, summarize, toDayKey } from './contributions';

const ana: CollaboratorProfile = {
  id: 'usr-ana',
  name: 'Ana Silva',
  codename: '@ana',
  avatarUrl: '',
  role: '',
  institution: '',
  country: '',
  specialty: '',
  bio: '',
  focusPlanets: ['Mars'],
  openToContributions: true,
};

const sample = (over: Partial<GeologicalSample>): GeologicalSample =>
  ({ id: 's1', name: 'Estudo 1', collectorName: 'Outra Pessoa', collectedAt: '2026-01-01', peerComments: [], ...over }) as GeologicalSample;

test('parseDay accepts ISO and "YYYY-MM-DD HH:mm UTC", rejects free text', () => {
  assert.equal(parseDay('2026-04-02T10:00:00.000Z'), '2026-04-02');
  assert.equal(parseDay('2026-04-02 11:15 UTC'), '2026-04-02');
  assert.equal(parseDay('Agora'), null);
  assert.equal(parseDay('Hoje · 09:40 UTC'), null);
  assert.equal(parseDay(undefined), null);
});

test('collects studies, reviews, endorsements, study messages and created groups', () => {
  const samples = [
    sample({ id: 'a', name: 'Dallol', collaboratorId: 'usr-ana', publishedAt: '2026-03-10T09:00:00Z' }),
    sample({
      id: 'b',
      name: 'Natron',
      peerComments: [
        { id: 'c1', sampleId: 'b', author: 'Ana Silva (@ana)', authorId: 'usr-ana', role: '', institution: '', timestamp: '2026-03-11 10:00 UTC', content: 'ok', statusChange: 'approved' },
        { id: 'c2', sampleId: 'b', author: 'Outro', role: '', institution: '', timestamp: '2026-03-11 11:00 UTC', content: 'x' },
      ],
    }),
  ];
  const studyThreads = {
    b: [
      { id: 'm1', collaboratorId: 'x', sender: 'user' as const, senderName: 'Ana Silva (@ana)', senderId: 'usr-ana', timestamp: '', sentAt: '2026-03-12T08:00:00Z', content: 'hi' },
      { id: 'm2', collaboratorId: 'x', sender: 'user' as const, senderName: 'Ana Silva (@ana)', timestamp: 'Agora', content: 'sem data' },
      { id: 'm3', collaboratorId: 'x', sender: 'researcher' as const, senderName: 'Copiloto IA', timestamp: '', sentAt: '2026-03-12T08:01:00Z', content: 'ai' },
    ],
  };
  const networkGroups = [
    { id: 'g1', title: 'Grupo Marte', targetPlanet: 'Mars' as const, objective: '', memberIds: ['usr-ana'], createdAt: '2026-03-13', createdBy: 'usr-ana' },
    { id: 'g2', title: 'Grupo de outro', targetPlanet: 'Mars' as const, objective: '', memberIds: ['usr-ana'], createdAt: '2026-03-13' },
  ];

  const events = collectContributions(ana, { samples, studyThreads, networkGroups });
  const kinds = events.map((e) => e.kind).sort();
  assert.deepEqual(kinds, ['discussion', 'endorsement', 'group', 'review', 'study']);
  assert.equal(events.reduce((s, e) => s + e.points, 0), 10 + 3 + 2 + 1 + 5);
});

test('summary counts streaks over consecutive days', () => {
  const ev = (date: string) => ({ date, kind: 'review' as const, points: 3, subject: 'x' });
  const today = new Date(2026, 2, 13); // 13 Mar 2026
  const s = summarize([ev('2026-03-01'), ev('2026-03-02'), ev('2026-03-03'), ev('2026-03-12'), ev('2026-03-13'), ev('2026-03-13')], today);
  assert.equal(s.totalCount, 6);
  assert.equal(s.activeDays, 5);
  assert.equal(s.longestStreak, 3);
  assert.equal(s.currentStreak, 2);
});

test('calendar is 53 Sunday-first weeks ending in the current week', () => {
  const today = new Date(2026, 10, 14); // Sat 14 Nov 2026
  const grid = buildCalendar([{ date: toDayKey(today), kind: 'study', points: 10, subject: 'x' }], today);
  assert.equal(grid.length, 53);
  assert.ok(grid.every((w) => w.length === 7));
  assert.equal(new Date(`${grid[0][0].date}T12:00:00`).getDay(), 0);
  const last = grid[52].find((d) => d.date === toDayKey(today))!;
  assert.equal(last.count, 1);
  assert.equal(last.level, 1);
});

test('intensity levels', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 20].map(levelFor), [0, 1, 2, 2, 3, 3, 4, 4]);
});
