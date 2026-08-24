import { describe, expect, it } from 'vitest';
import { buildPendingSources } from './supabase-history-replay-pending-sources';

describe('buildPendingSources', () => {
  it('sorts rows from every pending source block by migration filename', () => {
    const pending = buildPendingSources(
      'aaa 20260825000000_z.sql\nbbb 20260801000000_a.sql'
    );
    const rows = pending.split('\n');

    expect(rows[0]).toContain('20260801000000_a.sql');
    expect(rows.at(-1)).toContain('20260825000000_z.sql');
    expect(pending).toContain(
      '20260821180000_provider_neutral_ads_storage.sql'
    );
  });
});
