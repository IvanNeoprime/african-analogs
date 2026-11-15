import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GeologicalSample, PeerComment } from '../types';
import { endorseBlockReason, isValidated, reviewStatus, validEndorserIds } from './peerReview';

const comment = (authorId: string | undefined, approved: boolean): PeerComment => ({
  id: Math.random().toString(36),
  sampleId: 's',
  author: authorId || 'anónimo',
  authorId,
  role: '',
  institution: '',
  timestamp: '2026-11-01 10:00 UTC',
  content: 'x',
  statusChange: approved ? 'approved' : undefined,
});

const study = (comments: PeerComment[], status: GeologicalSample['status'] = 'under_review') =>
  ({ collaboratorId: 'author', peerComments: comments, status }) as GeologicalSample;

test('one endorsement is not enough; two independent reviewers validate', () => {
  assert.equal(isValidated(study([comment('r1', true)])), false);
  assert.equal(isValidated(study([comment('r1', true), comment('r2', true)])), true);
});

test('author self-endorsements, duplicates, anonymous and plain comments do not count', () => {
  const s = study([comment('author', true), comment('r1', true), comment('r1', true), comment(undefined, true), comment('r2', false)]);
  assert.deepEqual(validEndorserIds(s), ['r1']);
  assert.equal(isValidated(s), false);
});

test('endorse permissions', () => {
  const s = study([comment('r1', true)]);
  assert.equal(endorseBlockReason(s, null), 'not_signed_in');
  assert.equal(endorseBlockReason(s, 'author'), 'own_study');
  assert.equal(endorseBlockReason(s, 'r1'), 'already_endorsed');
  assert.equal(endorseBlockReason(s, 'r2'), null);
});

test('stored "verified" status from older builds is re-derived', () => {
  assert.equal(reviewStatus(study([comment('r1', true)], 'verified_peer_reviewed')), 'under_review');
  assert.equal(reviewStatus(study([], 'draft')), 'draft');
});
