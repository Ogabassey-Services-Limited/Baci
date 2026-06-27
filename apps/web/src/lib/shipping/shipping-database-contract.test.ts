import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const baselineMigration = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260418000000_baseline.sql'
  ),
  'utf8'
);

function tableDefinition(tableName: string): string {
  const start = baselineMigration.indexOf(
    `CREATE TABLE IF NOT EXISTS "public"."${tableName}" (`
  );
  const end = baselineMigration.indexOf(');', start);

  if (start === -1 || end === -1) {
    throw new Error(`Missing ${tableName} table in baseline migration`);
  }

  return baselineMigration.slice(start, end);
}

describe('shipping database contract', () => {
  it('uses station_name and station_address columns for station pickup persistence', () => {
    const shipments = tableDefinition('shipments');
    const shippingQuotes = tableDefinition('shipping_quotes');

    for (const table of [shipments, shippingQuotes]) {
      expect(table).toContain('"is_station_pickup" boolean DEFAULT false');
      expect(table).toContain('"station_name" "text"');
      expect(table).toContain('"station_address" "text"');
      expect(table).not.toContain('"pickup_station_name"');
      expect(table).not.toContain('"pickup_station_address"');
    }
  });
});
