import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  resolve(
    __dirname,
    '../../../../supabase/migrations/20260612090206_include_business_type_in_user_merchant_context.sql'
  ),
  'utf8'
);

describe('merchant context migration', () => {
  it('keeps staff merchant context from exposing owner financial and KYC fields', () => {
    expect(migrationSql).toMatch(/v_is_owner\s+boolean\s*:=\s*false/i);
    expect(migrationSql).toMatch(/v_is_owner\s*:=\s*true/i);

    for (const field of [
      'bank_code',
      'bank_account_number',
      'bank_name',
      'bank_account_name',
      'paystack_subaccount_code',
      'nin',
      'bvn',
      'cac_rc_number',
      'tax_identification_number',
      'legal_entity_name',
    ]) {
      expect(migrationSql).toMatch(
        new RegExp(
          `CASE\\s+WHEN\\s+v_is_owner\\s+THEN\\s+${field}\\s+ELSE\\s+NULL\\s+END\\s+AS\\s+${field}`,
          'i'
        )
      );
    }
  });
});
