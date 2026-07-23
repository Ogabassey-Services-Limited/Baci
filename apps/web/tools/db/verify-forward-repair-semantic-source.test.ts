import { describe, expect, it } from 'vitest';
import type { ForwardRepairDeploymentReceipt } from './schemas/forward-repair-deployment-receipt-schema';
import { verifyForwardRepairSemanticSource } from './verify-forward-repair-semantic-source';

const receipt = {
  deployment: {
    databaseJobId: 87824630957,
    headSha: 'bb55d407e01b719a9014c87fb8a8253861b7005d',
    jobConclusion: 'success',
    observedMigrationEntryCount: 3,
    runId: 29561460438,
    sanitizedJobLogSha256:
      '400990a8ee41f6550b609795b02c6e8090d9c056941ab488d5cee0a2fdfc8af1',
    summary: { applied: 3, skipped: 424 },
  },
  repairs: [
    {
      logOrdinal: 2,
      migration: {
        name: 'reconcile_domain_event_duplicate_jsonb_operator',
        version: '20260714225502',
      },
    },
    {
      logOrdinal: 3,
      migration: {
        name: 'reconcile_customer_order_cancellation_reason',
        version: '20260714225503',
      },
    },
  ],
} as ForwardRepairDeploymentReceipt;

function source() {
  return {
    databaseJobId: 87824630957,
    deploymentRunId: 29561460438,
    parsed: {
      appliedEntries: [
        {
          logOrdinal: 1,
          name: 'reconcile_order_fulfillment_timestamps',
          version: '20260714225501',
        },
        {
          logOrdinal: 2,
          name: 'reconcile_domain_event_duplicate_jsonb_operator',
          version: '20260714225502',
        },
        {
          logOrdinal: 3,
          name: 'reconcile_customer_order_cancellation_reason',
          version: '20260714225503',
        },
      ],
      summary: { applied: 3, skipped: 424 },
    },
    sanitizedJobLogSha256:
      '400990a8ee41f6550b609795b02c6e8090d9c056941ab488d5cee0a2fdfc8af1',
  };
}

describe('verifyForwardRepairSemanticSource', () => {
  it('binds both receipt ordinals to the complete deployment source', () => {
    expect(() =>
      verifyForwardRepairSemanticSource(receipt, source())
    ).not.toThrow();
  });

  it.each([
    (value: ReturnType<typeof source>) => {
      value.parsed.appliedEntries[0].logOrdinal = 2;
    },
    (value: ReturnType<typeof source>) => {
      value.parsed.appliedEntries[0].version = '20260714225500';
    },
    (value: ReturnType<typeof source>) => {
      value.parsed.appliedEntries[0].name = 'wrong';
    },
  ])('binds the manifest repair identity at the first log ordinal', (mutate) => {
    const value = source();
    mutate(value);

    expect(() => verifyForwardRepairSemanticSource(receipt, value)).toThrow(
      'Forward-repair semantic source mismatch'
    );
  });

  it.each([
    (value: ReturnType<typeof source>) => {
      value.parsed.appliedEntries[1].name = 'wrong';
    },
    (value: ReturnType<typeof source>) => {
      value.parsed.summary.skipped = 423;
    },
    (value: ReturnType<typeof source>) => {
      value.sanitizedJobLogSha256 = '0'.repeat(64);
    },
  ])('fails closed on semantic receipt drift', (mutate) => {
    const value = source();
    mutate(value);
    expect(() => verifyForwardRepairSemanticSource(receipt, value)).toThrow(
      'Forward-repair semantic source mismatch'
    );
  });
});
