import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalReplayEffectJson } from '../canonical-replay-effect-json';
import { productionOldCancellationSourceEffectsSchema } from './production-old-cancellation-source-effects-schema';

type MutableFixture = Record<string, unknown> & {
  digestVector: Array<{
    category: string;
    identity: string;
    sha256: string;
  }>;
  effectSha256: string;
  ledger: { rowCount: number; tailVersion: string };
  scope: { manifestSha256: string; version: string };
  source: { querySha256: string };
};

async function legacyFixture(): Promise<MutableFixture> {
  const fixture = JSON.parse(
    await readFile(
      path.resolve(
        import.meta.dirname,
        '../fixtures/production-history-effects.json'
      ),
      'utf8'
    )
  ) as MutableFixture;
  fixture.ledger = { rowCount: 439, tailVersion: '20260714225500' };
  return fixture;
}

describe('productionOldCancellationSourceEffectsSchema', () => {
  it('accepts the strict frozen pre-repair source shape', async () => {
    const fixture = await legacyFixture();
    expect(
      productionOldCancellationSourceEffectsSchema.parse(fixture).ledger
    ).toEqual({ rowCount: 439, tailVersion: '20260714225500' });
  });

  it('rejects changed legacy ledger or digest metadata', async () => {
    const fixture = await legacyFixture();
    fixture.ledger.rowCount = 442;
    expect(() =>
      productionOldCancellationSourceEffectsSchema.parse(fixture)
    ).toThrow();
    fixture.ledger.rowCount = 439;
    fixture.source.querySha256 = '0'.repeat(64);
    expect(() =>
      productionOldCancellationSourceEffectsSchema.parse(fixture)
    ).toThrow();
  });

  it('rejects a future scope version or scope manifest hash', async () => {
    const futureVersion = await legacyFixture();
    futureVersion.scope.version = 'baci-p0-effects-v4';
    expect(() =>
      productionOldCancellationSourceEffectsSchema.parse(futureVersion)
    ).toThrow();

    const futureManifest = await legacyFixture();
    futureManifest.scope.manifestSha256 = '0'.repeat(64);
    expect(() =>
      productionOldCancellationSourceEffectsSchema.parse(futureManifest)
    ).toThrow();
  });

  it('rejects a self-consistent digest outside the frozen v3 identity set', async () => {
    const fixture = await legacyFixture();
    const digest = fixture.digestVector.find(
      ({ identity }) => identity === 'public.orders.orders_cancelled_by_check'
    );
    if (!digest) throw new Error('Expected frozen v3 digest identity');
    digest.identity = 'public.orders.orders_cancelled_by_check_drift';
    fixture.effectSha256 = createHash('sha256')
      .update(canonicalReplayEffectJson(fixture.digestVector))
      .digest('hex');

    expect(() =>
      productionOldCancellationSourceEffectsSchema.parse(fixture)
    ).toThrow(/legacy effect digest vector scope mismatch/);
  });
});
