import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';

/**
 * SQLite storage (Node's built-in node:sqlite — no native dependency to compile).
 *
 * One row per record, each with an owner, so several people can work at the same time
 * without overwriting each other (the old single-JSON-file store replaced whole lists).
 * Records keep their full JSON in `data` so the front-end types can evolve freely;
 * ownership and relations are real columns the server enforces.
 */

// node:sqlite prints an ExperimentalWarning on load; it is stable enough for this use.
const originalEmitWarning = process.emitWarning.bind(process);
process.emitWarning = ((warning: string | Error, ...rest: any[]) => {
  if (String((warning as Error)?.message ?? warning).includes('SQLite is an experimental feature')) return;
  return (originalEmitWarning as any)(warning, ...rest);
}) as typeof process.emitWarning;
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as { DatabaseSync: typeof DatabaseSyncType };

export type Json = Record<string, any>;

export interface UserRow {
  id: string;
  email: string;
  codename: string;
  salt: string;
  hash: string;
  created_at: string;
  updated_at: string;
}

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  codename    TEXT NOT NULL UNIQUE,
  salt        TEXT NOT NULL,
  hash        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
  data        TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS samples (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  data        TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS peer_comments (
  id          TEXT PRIMARY KEY,
  sample_id   TEXT NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
  author_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  endorsed    INTEGER NOT NULL DEFAULT 0,
  data        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_sample ON peer_comments(sample_id);

CREATE TABLE IF NOT EXISTS study_messages (
  id          TEXT PRIMARY KEY,
  sample_id   TEXT NOT NULL,
  sender_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  data        TEXT NOT NULL,
  sent_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_sample ON study_messages(sample_id);

CREATE TABLE IF NOT EXISTS research_groups (
  id          TEXT PRIMARY KEY,
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  data        TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id    TEXT NOT NULL REFERENCES research_groups(id) ON DELETE CASCADE,
  member_id   TEXT NOT NULL,
  PRIMARY KEY (group_id, member_id)
);
`;

export class Store {
  readonly db: DatabaseSyncType;

  constructor(file: string) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(SCHEMA);
  }

  private txDepth = 0;

  /** Runs `fn` atomically. Nested calls join the outer transaction. */
  tx<T>(fn: () => T): T {
    if (this.txDepth > 0) {
      this.txDepth++;
      try {
        return fn();
      } finally {
        this.txDepth--;
      }
    }
    this.db.exec('BEGIN');
    this.txDepth = 1;
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    } finally {
      this.txDepth = 0;
    }
  }

  // ---------------------------------------------------------------- users & sessions
  findUserById(id: string): UserRow | undefined {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  }
  findUserByLogin(emailOrCodename: string): UserRow | undefined {
    return this.db.prepare('SELECT * FROM users WHERE email = ? OR codename = ?').get(emailOrCodename, emailOrCodename) as
      | UserRow
      | undefined;
  }
  emailTaken(email: string) {
    return Boolean(this.db.prepare('SELECT 1 FROM users WHERE email = ?').get(email));
  }
  codenameTaken(codename: string, exceptUserId?: string) {
    return Boolean(
      this.db.prepare('SELECT 1 FROM users WHERE codename = ? AND id IS NOT ?').get(codename, exceptUserId ?? null)
    );
  }
  insertUser(u: UserRow) {
    this.db
      .prepare('INSERT INTO users (id, email, codename, salt, hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(u.id, u.email, u.codename, u.salt, u.hash, u.created_at, u.updated_at);
  }
  updatePassword(id: string, salt: string, hash: string) {
    this.db.prepare('UPDATE users SET salt = ?, hash = ?, updated_at = ? WHERE id = ?').run(salt, hash, new Date().toISOString(), id);
  }
  updateCodename(id: string, codename: string) {
    this.db.prepare('UPDATE users SET codename = ?, updated_at = ? WHERE id = ?').run(codename, new Date().toISOString(), id);
  }
  createSession(token: string, userId: string, expiresAt: number) {
    this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    this.db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
  }
  sessionUser(token: string): string | null {
    const row = this.db.prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?').get(token) as
      | { user_id: string; expires_at: number }
      | undefined;
    return row && row.expires_at > Date.now() ? row.user_id : null;
  }
  deleteSession(token: string) {
    this.db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }

  // ---------------------------------------------------------------- profiles
  upsertProfile(id: string, ownerId: string | null, data: Json) {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO profiles (id, owner_id, data, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
      )
      .run(id, ownerId, JSON.stringify(data), now);
  }
  listProfiles(): Json[] {
    return (this.db.prepare('SELECT data FROM profiles ORDER BY updated_at DESC').all() as { data: string }[]).map((r) =>
      JSON.parse(r.data)
    );
  }

  // ---------------------------------------------------------------- samples & comments
  sampleOwner(id: string): { exists: boolean; ownerId: string | null } {
    const row = this.db.prepare('SELECT owner_id FROM samples WHERE id = ?').get(id) as { owner_id: string | null } | undefined;
    return { exists: Boolean(row), ownerId: row?.owner_id ?? null };
  }
  upsertSample(id: string, ownerId: string | null, data: Json) {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO samples (id, owner_id, data, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
      )
      .run(id, ownerId, JSON.stringify(data), now);
  }
  deleteSample(id: string) {
    this.db.prepare('DELETE FROM study_messages WHERE sample_id = ?').run(id);
    this.db.prepare('DELETE FROM samples WHERE id = ?').run(id);
  }
  getSample(id: string): Json | null {
    const row = this.db.prepare('SELECT data FROM samples WHERE id = ?').get(id) as { data: string } | undefined;
    if (!row) return null;
    return { ...JSON.parse(row.data), peerComments: this.commentsFor(id) };
  }
  listSamples(): Json[] {
    const rows = this.db.prepare('SELECT id, data FROM samples ORDER BY updated_at DESC').all() as { id: string; data: string }[];
    const comments = new Map<string, Json[]>();
    for (const c of this.db.prepare('SELECT sample_id, data FROM peer_comments ORDER BY created_at').all() as {
      sample_id: string;
      data: string;
    }[]) {
      comments.set(c.sample_id, [...(comments.get(c.sample_id) || []), JSON.parse(c.data)]);
    }
    return rows.map((r) => ({ ...JSON.parse(r.data), peerComments: comments.get(r.id) || [] }));
  }
  commentsFor(sampleId: string): Json[] {
    return (
      this.db.prepare('SELECT data FROM peer_comments WHERE sample_id = ? ORDER BY created_at').all(sampleId) as { data: string }[]
    ).map((r) => JSON.parse(r.data));
  }
  hasEndorsed(sampleId: string, authorId: string) {
    return Boolean(
      this.db.prepare('SELECT 1 FROM peer_comments WHERE sample_id = ? AND author_id = ? AND endorsed = 1').get(sampleId, authorId)
    );
  }
  insertComment(id: string, sampleId: string, authorId: string | null, endorsed: boolean, data: Json, createdAt: string) {
    this.db
      .prepare('INSERT INTO peer_comments (id, sample_id, author_id, endorsed, data, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, sampleId, authorId, endorsed ? 1 : 0, JSON.stringify(data), createdAt);
  }

  // ---------------------------------------------------------------- study discussion
  insertStudyMessage(id: string, sampleId: string, senderId: string | null, data: Json, sentAt: string) {
    this.db
      .prepare('INSERT OR IGNORE INTO study_messages (id, sample_id, sender_id, data, sent_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, sampleId, senderId, JSON.stringify(data), sentAt);
  }
  listStudyThreads(): Record<string, Json[]> {
    const out: Record<string, Json[]> = {};
    for (const r of this.db.prepare('SELECT sample_id, data FROM study_messages ORDER BY sent_at').all() as {
      sample_id: string;
      data: string;
    }[]) {
      (out[r.sample_id] ||= []).push(JSON.parse(r.data));
    }
    return out;
  }

  // ---------------------------------------------------------------- groups
  insertGroup(id: string, createdBy: string | null, data: Json, memberIds: string[]) {
    this.tx(() => {
      this.db
        .prepare('INSERT INTO research_groups (id, created_by, data, updated_at) VALUES (?, ?, ?, ?)')
        .run(id, createdBy, JSON.stringify(data), new Date().toISOString());
      const add = this.db.prepare('INSERT OR IGNORE INTO group_members (group_id, member_id) VALUES (?, ?)');
      for (const m of memberIds) add.run(id, m);
    });
  }
  groupExists(id: string) {
    return Boolean(this.db.prepare('SELECT 1 FROM research_groups WHERE id = ?').get(id));
  }
  toggleMembership(groupId: string, memberId: string): boolean {
    const isMember = Boolean(
      this.db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND member_id = ?').get(groupId, memberId)
    );
    if (isMember) this.db.prepare('DELETE FROM group_members WHERE group_id = ? AND member_id = ?').run(groupId, memberId);
    else this.db.prepare('INSERT INTO group_members (group_id, member_id) VALUES (?, ?)').run(groupId, memberId);
    return !isMember;
  }
  listGroups(): Json[] {
    const members = new Map<string, string[]>();
    for (const r of this.db.prepare('SELECT group_id, member_id FROM group_members').all() as {
      group_id: string;
      member_id: string;
    }[]) {
      members.set(r.group_id, [...(members.get(r.group_id) || []), r.member_id]);
    }
    return (
      this.db.prepare('SELECT id, created_by, data FROM research_groups ORDER BY updated_at DESC').all() as {
        id: string;
        created_by: string | null;
        data: string;
      }[]
    ).map((r) => ({ ...JSON.parse(r.data), createdBy: r.created_by ?? undefined, memberIds: members.get(r.id) || [] }));
  }

  isEmpty(): boolean {
    const row = this.db.prepare('SELECT (SELECT COUNT(*) FROM users) + (SELECT COUNT(*) FROM samples) AS n').get() as { n: number };
    return row.n === 0;
  }
}

/**
 * One-time import of the previous JSON files (.local-data/auth.json and
 * african-analogs-db.json). The originals are renamed to *.migrated, not deleted.
 */
export function migrateLegacyJson(store: Store, dir: string): string[] {
  const log: string[] = [];
  const authFile = path.join(dir, 'auth.json');
  const dbFile = path.join(dir, 'african-analogs-db.json');
  if (!store.isEmpty() || (!fs.existsSync(authFile) && !fs.existsSync(dbFile))) return log;

  const readJson = (f: string) => {
    try {
      return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf-8')) : null;
    } catch {
      return null;
    }
  };
  const auth = readJson(authFile);
  const state = readJson(dbFile);

  store.tx(() => {
    for (const c of Object.values<any>(auth?.credentials || {})) {
      store.insertUser({
        id: c.accountId,
        email: c.email,
        codename: c.codename,
        salt: c.salt,
        hash: c.hash,
        created_at: c.createdAt,
        updated_at: c.updatedAt,
      });
    }
    log.push(`${Object.keys(auth?.credentials || {}).length} conta(s)`);

    const userIds = new Set(Object.keys(auth?.credentials || {}));
    for (const p of state?.customProfiles || []) {
      if (!p?.id) continue;
      const { email: _email, ...publicProfile } = p;
      store.upsertProfile(p.id, userIds.has(p.id) ? p.id : null, publicProfile);
    }
    for (const s of state?.samples || []) {
      if (!s?.id) continue;
      const { peerComments = [], ...rest } = s;
      store.upsertSample(s.id, userIds.has(s.collaboratorId) ? s.collaboratorId : null, rest);
      for (const c of peerComments) {
        const authorId = c.authorId && userIds.has(c.authorId) ? c.authorId : null;
        store.insertComment(c.id, s.id, authorId, c.statusChange === 'approved' && Boolean(authorId), c, c.timestamp || '');
      }
    }
    log.push(`${(state?.samples || []).length} estudo(s)`);
    for (const [sampleId, msgs] of Object.entries<any[]>(state?.studyThreads || {})) {
      for (const m of msgs) {
        store.insertStudyMessage(m.id, sampleId, m.senderId && userIds.has(m.senderId) ? m.senderId : null, m, m.sentAt || '');
      }
    }
    for (const g of state?.networkGroups || []) {
      if (!g?.id || store.groupExists(g.id)) continue;
      const { memberIds = [], ...rest } = g;
      store.insertGroup(g.id, g.createdBy && userIds.has(g.createdBy) ? g.createdBy : null, rest, memberIds);
    }
  });

  for (const f of [authFile, dbFile]) if (fs.existsSync(f)) fs.renameSync(f, `${f}.migrated`);
  return log;
}
