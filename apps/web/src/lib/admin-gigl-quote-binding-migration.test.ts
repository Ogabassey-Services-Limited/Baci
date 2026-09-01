import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260901194000_bind_admin_gigl_quote.sql'
  ),
  'utf8'
);

describe('Admin GIGL quote binding migration', () => {
  it('defines an owner-checked transactional RPC with narrow grants', () => {
    expect(sql).toContain('FOR UPDATE');
    expect(sql).toContain('m.user_id = auth.uid()');
    expect(sql).toContain("shipping_funding_source='merchant_wallet'");
    expect(sql).toContain('REVOKE ALL ON FUNCTION');
    expect(sql).toContain('TO authenticated');
  });
});
