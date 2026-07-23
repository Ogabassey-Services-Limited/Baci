import {
  PENDING_SOURCES,
  PIPELINE_SOURCES,
  POST_REPLAY_SOURCES,
  PRODUCTION_MAPPINGS,
} from './supabase-history-replay-sources';
import type {
  FrozenReplaySource,
  ProductionReplayMapping,
  SupabaseHistoryReplayManifest,
} from './supabase-history-replay-types';

const migration = (filename: string) => `supabase/migrations/${filename}`;
function parseFrozenSources(rows: string): FrozenReplaySource[] {
  return rows
    .trim()
    .split('\n')
    .map((row) => {
      const separator = row.indexOf(' ');
      if (separator < 1 || separator === row.length - 1) {
        throw new Error('Invalid frozen replay source row');
      }
      return {
        repositoryPath: migration(row.slice(separator + 1)),
        sha256: row.slice(0, separator),
      };
    });
}

const mappingRules = {
  'append-only-repair': true,
  canonical: true,
  'superseded-final-state': true,
} satisfies Record<ProductionReplayMapping['rule'], true>;

const productionNames: Record<string, string> = {
  '20260623190041': 'enable_realtime_negotiation_requests',
  '20260624211416': 'merchant_email_domains',
  '20260625173604': 'public_read_storefront_feature_settings',
  '20260626131520': 'fix_search_products_condition_filter',
  '20260629154903': 'add_order_fulfillment_timestamps',
  '20260630123511': 'fix_mobile_admin_product_phantom_columns',
  '20260701080400': 'order_item_unit_costs_supplier_analytics',
  '20260701123945': 'supplier_purchase_analytics_branch_scope',
  '20260706202930': 'add_storefront_preflight_rpcs',
  '20260706210329': 'allow_page_config_history_insert',
  '20260707064146': 'add_blog_listing_preflight_rpc',
  '20260708072653': 'create_domain_purchase_transaction_rpc',
  '20260708072825': 'fix_domain_purchase_rpc_merchant_derivation',
  '20260708075932': 'lock_domain_purchase_rpc_service_role',
  '20260708102643': 'optimize_storefront_cached_merchant_and_variant_wrappers',
  '20260708220832': 'drop_authenticated_domain_purchase_rpc',
  '20260713200830': 'split_platform_blog_anon_read_policy',
};

function isMappingRule(
  value: string
): value is ProductionReplayMapping['rule'] {
  return value in mappingRules;
}

function parseProductionMappings(rows: string): ProductionReplayMapping[] {
  return rows
    .trim()
    .split('\n')
    .map((row) => {
      const [productionVersion, filename, sha256, rule, ...extra] =
        row.split('\t');
      const filenameMatch = filename?.match(/^(\d{14})_([a-z0-9_]+)\.sql$/);
      const linkedName = productionNames[productionVersion ?? ''];
      if (
        !productionVersion ||
        !linkedName ||
        !filename ||
        !filenameMatch ||
        !sha256 ||
        !rule ||
        extra.length > 0 ||
        !isMappingRule(rule)
      ) {
        throw new Error('Invalid production replay mapping row');
      }
      return {
        appliedName: filenameMatch[2] as string,
        appliedVersion: filenameMatch[1] as string,
        linkedName,
        productionVersion,
        repositoryPath: migration(filename),
        rule,
        sha256,
      };
    });
}

export const supabaseHistoryReplayManifest = {
  aliasReceipt: {
    path: 'apps/web/tools/db/fixtures/migration-name-alias-deploy-repair.json',
    sha256: 'ba97d2e25bb8d2f43e0a4fdfdb1fa37586fd9c7397458fa8dc0c0c5858288ade',
  },
  baseRegistry: {
    fileCount: 424,
    tailVersion: '20260714225500',
    uniqueVersionCount: 422,
  },
  baseSha: '9e3d1b14b1931a5e441fc23f0e5417c188056e47',
  bootstrap: {
    count: 125,
    receiptSha256:
      '06e17f84a563e147b290e90a307d269518d73d6452013fbe87570ee0fa70680e',
    tailPath: migration(
      '20260525060558_normalize_ogabassey_encoded_blog_slug.sql'
    ),
    tailSha256:
      '1de67f610fb29831ffb2606eb1b227d0d4e1708b21860282ebce5aba762c3293',
  },
  duplicateGroups: [
    {
      version: '20260615120000',
      sources: [
        [
          migration('20260615120000_customer_order_cancellation.sql'),
          'acb7406d4975c5cd8d3964e86b991b51046b6f750d49b3769699b878b92192d3',
        ],
        [
          migration('20260615120000_register_push_token_rpc.sql'),
          '6000b0006539041c1bd914567ebcbc31eb15e8f14401ae488d0a609ce74b4293',
        ],
      ],
    },
    {
      version: '20260713130000',
      sources: [
        [
          migration(
            '20260713130000_add_storefront_paystack_subaccount_configured_rpc.sql'
          ),
          '9cb95f8ba9ebd75568b9b5c7ee17521981465fa330d18a76ed467a179dd79645',
        ],
        [
          migration('20260713130000_quiz_finalize_rank_winners.sql'),
          '3140c3a76b2cd6ca1952dc166cd5e010d15c7070fde0647e41ad9bfc7d400ab2',
        ],
      ],
      uniqueReapply: [
        migration('20260713140000_quiz_finalize_rank_winners_reapply.sql'),
        'f3461eead2451852ecc9a643f34ca486207ea6b10b8ef3439e69718e738acd8c',
      ],
    },
  ],
  forwardRepairs: [
    {
      changedComponent: {
        category: 'function',
        identity:
          'eventing.resolve_domain_event_duplicate_v1(p_producer text, p_trust_level text, p_idempotency_key text, p_external_event_id text, p_event_name text, p_subject_type text, p_subject_id text, p_merchant_id uuid, p_data jsonb)',
      },
      path: migration(
        '20260714225502_reconcile_domain_event_duplicate_jsonb_operator.sql'
      ),
      reason: 'normalize_jsonb_subtraction_operator_resolution',
      sha256:
        '537f5654e8ca811d926fe0642d410e13c13c39703bba8a7d18372a8000784263',
    },
    {
      changedComponent: {
        category: 'function',
        identity:
          'public.cancel_order_as_customer(p_order_id uuid, p_reason text)',
      },
      path: migration(
        '20260714225503_reconcile_customer_order_cancellation_reason.sql'
      ),
      reason: 'reconcile_cancellation_reason_and_execute_acl',
      sha256:
        '6c5f9ca9ed75b63e241f25e1dddfab9b2d7da1bab7cb91694b92a1d9548d7a71',
    },
  ],
  forwardRepairReceipt: {
    path: 'apps/web/tools/db/fixtures/forward-repair-deployment-receipt.json',
    schemaVersion: 1,
    sha256: '8258b2098f1086a60e166935edf5313f2601977979d4eb1cb31c8ca41ef94e8c',
  },
  linkedLedgerFixture: {
    linkedRowCount: 442,
    linkedTailVersion: '20260714225503',
    localFileCount: 424,
    localUniqueVersionCount: 422,
    path: 'apps/web/tools/db/fixtures/linked-migration-ledger.json',
    schemaVersion: 1,
    sha256: '0d8b54ecdae67d99da4e806276310e80992bda73ee94efaaf7a91fd16c3d8885',
  },
  pipelineSources: parseFrozenSources(PIPELINE_SOURCES),
  pendingSources: parseFrozenSources(PENDING_SOURCES),
  postReplaySources: parseFrozenSources(POST_REPLAY_SOURCES),
  productionMappings: parseProductionMappings(PRODUCTION_MAPPINGS),
  productionEffectsFixture: {
    effectSha256:
      '71cba5629959c75352726e26cafcbfec8de99b1b52d10e6ad70fd85f07e4d253',
    ledgerRowCount: 442,
    ledgerTailVersion: '20260714225503',
    path: 'apps/web/tools/db/fixtures/production-history-effects.json',
    querySha256:
      '2b555af09c8a9cb7e8026b028c014b304de146a9f50a2c2f2a896a6626dfacbc',
    schemaVersion: 2,
    sha256: 'bc1e37a53410d8dbeead2f3929a6e47149589ba68806fca88a359e0b9c7411c1',
  },
  provenance: {
    evidenceSourceCount: 25,
    exceptionalRecordCount: 31,
    path: 'apps/web/tools/db/fixtures/production-effect-provenance.json',
    relationCount: 9,
    schemaVersion: 5,
    sha256: '1f1e4e3112a0010dbed91a25a8185d38fcfd4cf56d2d2b60ca76306bbbb100e1',
  },
  repair: {
    body: 'ALTER TABLE public.orders\n  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,\n  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;\n',
    path: migration(
      '20260714225501_reconcile_order_fulfillment_timestamps.sql'
    ),
    sha256: '1f6b9c1e12afbbab4e32a697230cebbe196fb9d43daf340caba1eb309370a361',
  },
  semanticFixture: {
    path: 'apps/web/tools/db/fixtures/github-migration-semantic-lines.json',
    sha256: '1d550b33b8f681cdd2f1751279e6d93c1110457834d8743969aa6047d7e33eca',
    sourceCount: 27,
  },
  transforms: [
    {
      originalSha256:
        '2b1ebac0ab9514d5b6c91e0ebf4543e3470b9fa71b0a80ab0746c9cccc9a4c41',
      outputSha256:
        '6f6444120e4cefe5febaba935ea70e7a304bf2d330702afc838d4ab70a77b9d8',
      overlayPath:
        'supabase/tests/migration_history_overlays/20260525140048_quiz_authoritative_answer_scoring.sql',
      replacement: 'extract(epoch FROM (pg_catalog.now() - v_issued_at))',
      repositoryPath: migration(
        '20260525140048_quiz_authoritative_answer_scoring.sql'
      ),
      search: 'pg_catalog.extract(epoch FROM (pg_catalog.now() - v_issued_at))',
    },
  ],
} as const satisfies SupabaseHistoryReplayManifest;
