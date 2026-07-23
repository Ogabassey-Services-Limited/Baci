import { describe, expect, it } from 'vitest';
import { assessAgenticDvaCutoverSession } from './agentic-dva-cutover-evidence';
import { agenticDvaCutoverEvidenceTestSupport } from './agentic-dva-cutover-evidence-test-support';

const now = new Date('2026-07-20T12:00:00.000Z');
const { accountReadyRow } = agenticDvaCutoverEvidenceTestSupport;

describe('assessAgenticDvaCutoverSession invariants', () => {
  it('blocks malformed account and incomplete order snapshots', () => {
    const malformedAccount = accountReadyRow();
    const malformedMetadata = malformedAccount.metadata as {
      agentic: Record<string, unknown>;
    };
    malformedMetadata.agentic.dva_account = {
      account_name: 'Ada Lovelace',
      account_number: 'not-an-account',
      bank_name: 'Paystack-Titan',
    };
    malformedAccount.payment_reference = 'not-an-account';
    malformedAccount.virtual_account_number = 'not-an-account';
    expect(assessAgenticDvaCutoverSession(malformedAccount, now)).toMatchObject(
      {
        disposition: 'manual_review',
        reason: 'stored_account_missing',
      }
    );

    const emptySnapshot = accountReadyRow();
    const emptyMetadata = emptySnapshot.metadata as {
      agentic: Record<string, unknown>;
    };
    emptyMetadata.agentic.line_items = [];
    expect(assessAgenticDvaCutoverSession(emptySnapshot, now)).toMatchObject({
      disposition: 'manual_review',
      reason: 'payment_snapshot_invalid',
    });

    expect(
      assessAgenticDvaCutoverSession(
        accountReadyRow({ shipping_address: null }),
        now
      )
    ).toMatchObject({
      disposition: 'manual_review',
      reason: 'fulfillment_snapshot_missing',
    });
  });

  it('blocks mutable cart, amount, and released-order marker drift', () => {
    expect(
      assessAgenticDvaCutoverSession(
        accountReadyRow({ cart_items: [{ id: 'product-2', quantity: 1 }] }),
        now
      )
    ).toMatchObject({
      disposition: 'manual_review',
      reason: 'cart_snapshot_mismatch',
    });
    expect(
      assessAgenticDvaCutoverSession(
        accountReadyRow({ total_amount: 499999 }),
        now
      )
    ).toMatchObject({
      disposition: 'manual_review',
      reason: 'amount_snapshot_mismatch',
    });

    const metadata = accountReadyRow().metadata as {
      agentic: Record<string, unknown>;
    };
    expect(
      assessAgenticDvaCutoverSession(
        accountReadyRow({
          metadata: {
            agentic: {
              ...metadata.agentic,
              finalization_order_id: 'canceled-order-1',
            },
          },
        }),
        now
      )
    ).toMatchObject({
      disposition: 'manual_review',
      reason: 'released_finalization_order_requires_review',
    });
  });

  it('requires an exact existing finalization claim when resuming that state', () => {
    const metadata = accountReadyRow().metadata as {
      agentic: Record<string, unknown>;
    };
    const valid = assessAgenticDvaCutoverSession(
      accountReadyRow({
        metadata: {
          agentic: {
            ...metadata.agentic,
            finalization_claim: `agentic_order_${'a'.repeat(64)}`,
            finalization_order_id: 'order-1',
            payment_state: 'order_finalizing',
          },
        },
      }),
      now
    );
    expect(valid).toMatchObject({
      disposition: 'resume_stored_account',
      state: 'order_finalizing',
    });
    expect(valid.resume?.unwrap().finalizationClaim).toBe(
      `agentic_order_${'a'.repeat(64)}`
    );

    expect(
      assessAgenticDvaCutoverSession(
        accountReadyRow({
          metadata: {
            agentic: {
              ...metadata.agentic,
              finalization_claim: `agentic_order_${'a'.repeat(64)}`,
              payment_state: 'order_finalizing',
            },
          },
        }),
        now
      )
    ).toMatchObject({
      disposition: 'manual_review',
      reason: 'finalization_order_marker_missing',
    });

    expect(
      assessAgenticDvaCutoverSession(
        accountReadyRow({
          metadata: {
            agentic: {
              ...metadata.agentic,
              payment_state: 'order_finalizing',
            },
          },
        }),
        now
      )
    ).toMatchObject({
      disposition: 'manual_review',
      reason: 'finalization_claim_missing',
    });
  });

  it('fingerprints canonical evidence independent of object key order', () => {
    const original = accountReadyRow();
    const reordered = reverseObjectKeysRecursively(original);

    expect(
      assessAgenticDvaCutoverSession(original, now).evidenceFingerprint
    ).toBe(assessAgenticDvaCutoverSession(reordered, now).evidenceFingerprint);
  });
});

function reverseObjectKeysRecursively(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseObjectKeysRecursively);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .reverse()
      .map(([key, nestedValue]) => [
        key,
        reverseObjectKeysRecursively(nestedValue),
      ])
  );
}
