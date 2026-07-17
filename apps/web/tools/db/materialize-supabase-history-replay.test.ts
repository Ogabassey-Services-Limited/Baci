import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { materializeSupabaseHistoryReplay } from './materialize-supabase-history-replay';
import type { VerifiedReplayManifest } from './supabase-history-replay-types';
import { verifySupabaseHistoryReplayManifest } from './verify-supabase-history-replay-manifest';

const workspaceRoot = path.resolve(import.meta.dirname, '../../../..');
let verified: VerifiedReplayManifest;

function requiredIndexOf(
  sources: readonly { repositoryPath: string }[],
  filename: string
): number {
  const source = sources.find(({ repositoryPath }) =>
    repositoryPath.endsWith(filename)
  );
  if (!source) throw new Error(`missing required replay source: ${filename}`);
  return sources.indexOf(source);
}

function cloneVerified(): VerifiedReplayManifest {
  return structuredClone(verified);
}

beforeAll(async () => {
  verified = await verifySupabaseHistoryReplayManifest(workspaceRoot, {
    pendingRepairState: 'materialized',
  });
}, 60_000);

describe('materializeSupabaseHistoryReplay', () => {
  it('throws when a required source lookup is missing', () => {
    expect(() => requiredIndexOf([], 'missing.sql')).toThrow(/missing\.sql/);
  });

  it('orders the chronological replay by version then filename', () => {
    const sources = materializeSupabaseHistoryReplay(verified, 'chronological');

    expect(sources).toHaveLength(427);
    expect(
      requiredIndexOf(sources, '20260615120000_customer_order_cancellation.sql')
    ).toBeLessThan(
      requiredIndexOf(sources, '20260615120000_register_push_token_rpc.sql')
    );
    expect(
      requiredIndexOf(
        sources,
        '20260713130000_add_storefront_paystack_subaccount_configured_rpc.sql'
      )
    ).toBeLessThan(
      requiredIndexOf(sources, '20260713130000_quiz_finalize_rank_winners.sql')
    );
  });

  it('constructs the deterministic production-effect partial order', () => {
    const sources = materializeSupabaseHistoryReplay(
      verified,
      'production-effect'
    );
    const pushIndex = requiredIndexOf(
      sources,
      '20260615120000_register_push_token_rpc.sql'
    );

    expect(sources).toHaveLength(426);
    expect(
      sources[pushIndex + 1]?.repositoryPath.endsWith(
        '20260615120000_customer_order_cancellation.sql'
      )
    ).toBe(true);
    expect(
      sources.findIndex(({ repositoryPath }) =>
        repositoryPath.endsWith('20260713130000_quiz_finalize_rank_winners.sql')
      )
    ).toBe(-1);
    expect(
      requiredIndexOf(
        sources,
        '20260713140000_quiz_finalize_rank_winners_reapply.sql'
      )
    ).toBeGreaterThan(
      requiredIndexOf(
        sources,
        '20260713130000_add_storefront_paystack_subaccount_configured_rpc.sql'
      )
    );
  });

  it('enforces the recorded late primary-job chain', () => {
    const sources = materializeSupabaseHistoryReplay(
      verified,
      'production-effect'
    );
    const orderedFilenames = [
      '20260714123000_complete_order_gateway_payment_atomic.sql',
      '20260713123000_preserve_repeat_order_notification_cycles.sql',
      '20260714161000_claim_wallet_credit_push.sql',
      '20260714102200_quiz_identity_and_device_caps.sql',
      '20260714225500_release_wallet_credit_push.sql',
      '20260714220000_quiz_event_lifecycle_followup.sql',
    ];
    const indexes = orderedFilenames.map((filename) =>
      requiredIndexOf(sources, filename)
    );

    expect(indexes.every((value) => value >= 0)).toBe(true);
    expect(indexes).toEqual([...indexes].sort((left, right) => left - right));
  });

  it('is stable when verified source input order changes', () => {
    const shuffled = cloneVerified();
    shuffled.verifiedSources = [...shuffled.verifiedSources].reverse();

    expect(
      materializeSupabaseHistoryReplay(shuffled, 'production-effect')
    ).toEqual(materializeSupabaseHistoryReplay(verified, 'production-effect'));
  });

  it('moves canonical and superseded mappings to their linked splices', () => {
    const sources = materializeSupabaseHistoryReplay(
      verified,
      'production-effect'
    );

    expect(
      requiredIndexOf(
        sources,
        '20260714010000_scope_feature_settings_read_policies.sql'
      )
    ).toBeGreaterThan(
      requiredIndexOf(
        sources,
        '20260625120000_add_negotiation_customer_phone.sql'
      )
    );
    expect(
      requiredIndexOf(
        sources,
        '20260714010000_scope_feature_settings_read_policies.sql'
      )
    ).toBeLessThan(
      requiredIndexOf(
        sources,
        '20260626130058_replace_imported_order_items_rpc.sql'
      )
    );
    expect(
      requiredIndexOf(
        sources,
        '20260702024830_fix_search_products_condition_filter.sql'
      )
    ).toBeGreaterThan(
      requiredIndexOf(
        sources,
        '20260626130058_replace_imported_order_items_rpc.sql'
      )
    );
    expect(
      requiredIndexOf(
        sources,
        '20260702024830_fix_search_products_condition_filter.sql'
      )
    ).toBeLessThan(
      requiredIndexOf(
        sources,
        '20260626171000_harden_merchant_email_domain_case_uniqueness.sql'
      )
    );
  });

  it('places the applied repair at its recorded post-deploy boundary', () => {
    const materialized = cloneVerified();
    materialized.pendingRepairState = 'materialized';
    const chronological = materializeSupabaseHistoryReplay(
      materialized,
      'chronological'
    );
    const productionEffect = materializeSupabaseHistoryReplay(
      materialized,
      'production-effect'
    );
    const repair = '20260714225501_reconcile_order_fulfillment_timestamps.sql';

    expect(chronological).toHaveLength(427);
    expect(productionEffect).toHaveLength(426);
    expect(requiredIndexOf(productionEffect, repair)).toBeGreaterThan(
      requiredIndexOf(
        productionEffect,
        '20260714220000_quiz_event_lifecycle_followup.sql'
      )
    );
    expect(
      productionEffect
        .slice(-3)
        .map(({ repositoryPath }) => path.posix.basename(repositoryPath))
    ).toEqual([
      repair,
      '20260714225502_reconcile_domain_event_duplicate_jsonb_operator.sql',
      '20260714225503_reconcile_customer_order_cancellation_reason.sql',
    ]);
  });

  it('appends ordered forward repairs after both frozen replay modes', () => {
    const expectedTail = [
      '20260714225502_reconcile_domain_event_duplicate_jsonb_operator.sql',
      '20260714225503_reconcile_customer_order_cancellation_reason.sql',
    ];

    for (const mode of ['chronological', 'production-effect'] as const) {
      const sources = materializeSupabaseHistoryReplay(verified, mode);
      expect(
        sources.slice(-2).map(({ receiptId, repositoryPath }) => ({
          receiptId,
          repositoryPath: path.posix.basename(repositoryPath),
        }))
      ).toEqual(
        expectedTail.map((repositoryPath) => ({
          receiptId: `forward-repair:supabase/migrations/${repositoryPath}`,
          repositoryPath,
        }))
      );
    }
  });

  it('rejects mapped-splice binding drift', () => {
    const invalid = cloneVerified();
    invalid.manifest.productionMappings[0].repositoryPath =
      'supabase/migrations/20260623190000_wrong_owner.sql';

    expect(() =>
      materializeSupabaseHistoryReplay(invalid, 'production-effect')
    ).toThrow('mapping splice binding drift');
  });
});
