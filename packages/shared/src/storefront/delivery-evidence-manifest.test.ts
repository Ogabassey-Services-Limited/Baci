import { describe, expect, it } from 'vitest';
import { calculateStorefrontDeliveryDailyEvidenceSha256 } from './delivery-evidence';
import { validateStorefrontDeliveryManifest } from './delivery-evidence-manifest';
import {
  manifest,
  sevenDays,
} from './delivery-evidence-manifest.test-fixtures';

describe('validateStorefrontDeliveryManifest', () => {
  const now = new Date('2026-08-01T12:00:00.000Z');
  it('accepts exactly seven contiguous closed UTC days', () =>
    expect(validateStorefrontDeliveryManifest(manifest(), { now }).ok).toBe(
      true
    ));
  it('rejects a missing day and an unsorted or omitted hostname partition', () => {
    expect(
      validateStorefrontDeliveryManifest(
        { ...manifest(), days: sevenDays().slice(1) },
        { now }
      ).ok
    ).toBe(false);
    expect(
      validateStorefrontDeliveryManifest({
        ...manifest(),
        aliasHostnames: ['www.ogabassey.com'],
        inventoryHostnames: ['ogabassey.com', 'www.ogabassey.com'],
      }).ok
    ).toBe(false);
  });
  it('rejects tampered daily or canonical hostname-inventory hashes', () => {
    const tamperedDay = manifest();
    tamperedDay.days[0].sha256 = 'f'.repeat(64);
    expect(validateStorefrontDeliveryManifest(tamperedDay, { now }).ok).toBe(
      false
    );
    expect(
      validateStorefrontDeliveryManifest(
        { ...manifest(), hostnameInventorySha256: 'f'.repeat(64) },
        { now }
      ).ok
    ).toBe(false);
  });
  it('rejects a daily drift from each independent evidence source even with a resealed daily hash', () => {
    for (const source of [
      'invocation',
      'aliasRedirect',
      'wafRateLimit',
      'originEvent',
    ] as const) {
      const candidate = manifest();
      candidate.days[3].sourceEvidence[source].sourceFingerprint = 'f'.repeat(
        64
      );
      candidate.days[3].sha256 = calculateStorefrontDeliveryDailyEvidenceSha256(
        candidate.days[3]
      );
      expect(
        validateStorefrontDeliveryManifest(candidate, { now })
      ).toMatchObject({
        ok: false,
        reasonCodes: expect.arrayContaining(['source_fingerprint_drift']),
      });
    }
    const syntheticCandidate = manifest();
    syntheticCandidate.days[3].sourceEvidence.syntheticQualification = {
      ...syntheticCandidate.days[3].sourceEvidence.syntheticQualification,
      sourceFingerprint: 'f'.repeat(64),
    };
    syntheticCandidate.days[3].sha256 =
      calculateStorefrontDeliveryDailyEvidenceSha256(
        syntheticCandidate.days[3]
      );
    expect(
      validateStorefrontDeliveryManifest(syntheticCandidate, { now })
    ).toMatchObject({
      ok: false,
      reasonCodes: expect.arrayContaining(['source_fingerprint_drift']),
    });
  });
  it('rejects daily response-header and raw-origin robots identity drift even with a resealed daily hash', () => {
    for (const key of [
      'responseHeaderRulesetSha256',
      'rawOriginRobotsTxtSha256',
    ] as const) {
      const candidate = manifest();
      candidate.days[3][key] = 'f'.repeat(64);
      candidate.days[3].sha256 = calculateStorefrontDeliveryDailyEvidenceSha256(
        candidate.days[3]
      );
      expect(
        validateStorefrontDeliveryManifest(candidate, { now })
      ).toMatchObject({
        ok: false,
        reasonCodes: expect.arrayContaining(['fingerprint_drift']),
      });
    }
  });
  it('rejects calendar-invalid UTC boundaries even when their normalized duration hashes correctly', () => {
    const candidate = manifest();
    candidate.windowStart = '2026-02-30T00:00:00.000Z';
    expect(
      validateStorefrontDeliveryManifest(candidate, { now })
    ).toMatchObject({ ok: false, reasonCodes: ['manifest_invalid'] });
  });
  it('requires both known Ogabassey aliases at schema parse time', () => {
    expect(
      validateStorefrontDeliveryManifest(
        { ...manifest(), aliasHostnames: ['www.ogabassey.com'] },
        { now }
      )
    ).toMatchObject({ ok: false, reasonCodes: ['manifest_invalid'] });
  });
  it('rejects a stale window and an export timestamp after validation time', () => {
    const stale = manifest();
    stale.windowStart = '2026-06-25T00:00:00.000Z';
    stale.windowEnd = '2026-07-02T00:00:00.000Z';
    stale.days = sevenDays().map((day, index) => ({
      ...day,
      utcDate: new Date(Date.UTC(2026, 5, 25 + index))
        .toISOString()
        .slice(0, 10),
      exportedAt: new Date(Date.UTC(2026, 5, 26 + index)).toISOString(),
    }));
    expect(validateStorefrontDeliveryManifest(stale, { now })).toMatchObject({
      ok: false,
      reasonCodes: expect.arrayContaining(['window_stale']),
    });
    const future = manifest();
    future.days[6].exportedAt = '2026-08-01T13:00:00.000Z';
    future.days[6].sha256 = calculateStorefrontDeliveryDailyEvidenceSha256(
      future.days[6]
    );
    expect(validateStorefrontDeliveryManifest(future, { now })).toMatchObject({
      ok: false,
      reasonCodes: expect.arrayContaining(['day_exported_in_future']),
    });
  });
});
