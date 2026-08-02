import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MERCHANT_COUNTRIES } from '@baci/shared/constants';
import { describe, expect, it } from 'vitest';
import { COUNTRIES } from './countries';

const migrationSql = readFileSync(
  join(
    process.cwd(),
    '../../supabase/migrations/20260728091958_provision_mobile_merchant_v2.sql'
  ),
  'utf8'
);

function readSqlCountryCurrencyMap(): Record<string, string> {
  const section = migrationSql
    .split('-- merchant-country-currency-map:start')[1]
    ?.split('-- merchant-country-currency-map:end')[0];

  if (!section) {
    throw new Error('Missing merchant country/currency contract markers');
  }

  return Object.fromEntries(
    [...section.matchAll(/WHEN '([A-Z]{2})' THEN '([A-Z]{3})'/g)].map(
      ([, code, currency]) => [code, currency]
    )
  );
}

describe('mobile merchant country contract', () => {
  it('keeps SQL payout derivation identical to the shared catalog', () => {
    expect(readSqlCountryCurrencyMap()).toEqual(
      Object.fromEntries(
        MERCHANT_COUNTRIES.map(({ code, currency }) => [code, currency])
      )
    );
  });

  it('keeps the web compatibility adapter on the same supported codes', () => {
    expect(COUNTRIES.map(({ code }) => code)).toEqual(
      MERCHANT_COUNTRIES.map(({ code }) => code)
    );
  });

  it('does not expose a caller-selected payout currency argument', () => {
    expect(migrationSql).not.toMatch(/\bp_payout_currency\b/i);
  });
});
