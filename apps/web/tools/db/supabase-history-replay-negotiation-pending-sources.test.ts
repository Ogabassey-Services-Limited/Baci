import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NEGOTIATION_PENDING_REPLAY_SOURCE_ROWS } from './supabase-history-replay-negotiation-pending-sources';

const REPOSITORY_ROOT = path.resolve(__dirname, '../../../..');

describe('negotiation pending replay sources', () => {
  it('pins the contact-enforcement migration to its checked-in bytes', async () => {
    const [sha256, filename, ...extra] =
      NEGOTIATION_PENDING_REPLAY_SOURCE_ROWS.split(' ');
    if (!sha256 || !filename || extra.length !== 0) {
      throw new Error('Invalid negotiation pending replay source row');
    }

    const migration = await readFile(
      path.join(REPOSITORY_ROOT, 'supabase/migrations', filename)
    );
    expect(createHash('sha256').update(migration).digest('hex')).toBe(sha256);
  });
});
