import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260814130000_separate_quiet_deferral_failure_attempts.sql'
  ),
  'utf8'
).toLowerCase();

describe('quiet deferral failure attempts migration contract', () => {
  it('tracks real delivery failures separately from the started marker', () => {
    expect(sql).toContain(
      'delivery_failure_attempts integer not null default 0'
    );
    expect(sql).toContain(
      'delivery_attempts = greatest(n.delivery_attempts, 1)'
    );
    expect(sql).toContain(
      'delivery_failure_attempts = delivery_failure_attempts + 1'
    );
    expect(sql).not.toContain('delivery_attempts = n.delivery_attempts + 1');
  });

  it('keeps quiet-hour polls eligible after the failure retry ceiling', () => {
    expect(sql).toContain(
      "n.delivery_last_error in ('quiet_hours_deferred', 'quiet_hours_claimed')"
    );
    expect(sql).toContain('n.delivery_failure_attempts < 3');
  });
});
