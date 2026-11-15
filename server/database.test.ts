import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { migrateLegacyJson, Store } from './database';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'aa-db-'));
const user = (id: string) => ({
  id,
  email: `${id}@example.com`,
  codename: `@${id}`,
  salt: 's',
  hash: 'h',
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
});

test('users, sessions and unique constraints', () => {
  const store = new Store(':memory:');
  store.insertUser(user('ana'));
  assert.ok(store.emailTaken('ana@example.com'));
  assert.throws(() => store.insertUser({ ...user('ana2'), email: 'ana@example.com' }));
  store.createSession('tok', 'ana', Date.now() + 60_000);
  assert.equal(store.sessionUser('tok'), 'ana');
  store.createSession('old', 'ana', Date.now() - 1);
  assert.equal(store.sessionUser('old'), null);
});

test('samples carry their comments and keep the owner', () => {
  const store = new Store(':memory:');
  store.insertUser(user('ana'));
  store.insertUser(user('rui'));
  store.upsertSample('s1', 'ana', { id: 's1', name: 'Dallol' });
  store.insertComment('c1', 's1', 'rui', true, { id: 'c1', content: 'bom', statusChange: 'approved' }, '2026-01-02');
  assert.equal(store.sampleOwner('s1').ownerId, 'ana');
  assert.ok(store.hasEndorsed('s1', 'rui'));
  assert.equal(store.getSample('s1')?.peerComments.length, 1);
  store.upsertSample('s1', 'ana', { id: 's1', name: 'Dallol v2' });
  assert.equal(store.listSamples()[0].name, 'Dallol v2');
  assert.equal(store.listSamples()[0].peerComments.length, 1, 'editing a study keeps its comments');
});

test('group membership toggles per person', () => {
  const store = new Store(':memory:');
  store.insertUser(user('ana'));
  store.insertGroup('g1', 'ana', { id: 'g1', title: 'Marte' }, ['ana']);
  assert.equal(store.toggleMembership('g1', 'rui'), true);
  assert.deepEqual(store.listGroups()[0].memberIds.sort(), ['ana', 'rui']);
  assert.equal(store.toggleMembership('g1', 'rui'), false);
  assert.deepEqual(store.listGroups()[0].memberIds, ['ana']);
});

test('legacy JSON files are imported once and renamed, without e-mails in profiles', () => {
  const dir = tmpDir();
  fs.writeFileSync(
    path.join(dir, 'auth.json'),
    JSON.stringify({ credentials: { ana: { accountId: 'ana', email: 'ana@x.com', codename: '@ana', salt: 's', hash: 'h', createdAt: 't', updatedAt: 't' } } })
  );
  fs.writeFileSync(
    path.join(dir, 'african-analogs-db.json'),
    JSON.stringify({
      customProfiles: [{ id: 'ana', name: 'Ana', email: 'ana@x.com' }],
      samples: [{ id: 's1', collaboratorId: 'ana', name: 'Natron', peerComments: [] }],
      networkGroups: [{ id: 'g1', title: 'G', memberIds: ['ana'] }],
    })
  );
  const store = new Store(path.join(dir, 'db.sqlite'));
  const log = migrateLegacyJson(store, dir);
  assert.ok(log.length > 0);
  assert.equal(store.findUserById('ana')?.email, 'ana@x.com');
  assert.equal(store.listProfiles()[0].email, undefined);
  assert.equal(store.sampleOwner('s1').ownerId, 'ana');
  assert.ok(fs.existsSync(path.join(dir, 'auth.json.migrated')));
  assert.deepEqual(migrateLegacyJson(store, dir), [], 'second run does nothing');
  store.db.close();
});
