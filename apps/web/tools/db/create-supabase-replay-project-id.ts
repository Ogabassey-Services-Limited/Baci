import { randomBytes } from 'node:crypto';

const ENTROPY_HEX = /^[a-f0-9]{24}$/;

export function createSupabaseReplayProjectId(
  entropyHex = randomBytes(12).toString('hex')
): string {
  if (!ENTROPY_HEX.test(entropyHex)) {
    throw new Error('Invalid Supabase replay project entropy');
  }
  return `baci_replay_${entropyHex}`;
}
