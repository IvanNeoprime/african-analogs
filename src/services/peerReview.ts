import type { GeologicalSample } from '../types';

/**
 * Peer-review rules. A study only counts as validated when enough *independent*
 * signed-in reviewers endorsed it: the author cannot endorse their own study and each
 * reviewer counts once.
 */
export const REQUIRED_ENDORSEMENTS = 2;

/** Distinct reviewer ids (excluding the author) who endorsed the study. */
export function validEndorserIds(sample: Pick<GeologicalSample, 'peerComments' | 'collaboratorId'>): string[] {
  const ids = new Set<string>();
  for (const c of sample.peerComments || []) {
    if (c.statusChange !== 'approved' || !c.authorId) continue;
    if (sample.collaboratorId && c.authorId === sample.collaboratorId) continue;
    ids.add(c.authorId);
  }
  return [...ids];
}

export function isValidated(sample: Pick<GeologicalSample, 'peerComments' | 'collaboratorId'>): boolean {
  return validEndorserIds(sample).length >= REQUIRED_ENDORSEMENTS;
}

export type EndorseBlockReason = 'not_signed_in' | 'own_study' | 'already_endorsed' | null;

export function endorseBlockReason(
  sample: Pick<GeologicalSample, 'peerComments' | 'collaboratorId'>,
  userId: string | null | undefined
): EndorseBlockReason {
  if (!userId) return 'not_signed_in';
  if (sample.collaboratorId === userId) return 'own_study';
  if (validEndorserIds(sample).includes(userId)) return 'already_endorsed';
  return null;
}

/** Status derived from the rules above (never set directly by a single comment). */
export function reviewStatus(sample: GeologicalSample): GeologicalSample['status'] {
  if (isValidated(sample)) return 'verified_peer_reviewed';
  return sample.status === 'draft' ? 'draft' : 'under_review';
}
