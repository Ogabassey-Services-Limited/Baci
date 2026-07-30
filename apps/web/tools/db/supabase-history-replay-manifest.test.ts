import { describe, expect, it } from 'vitest';
import { EXPECTED_DUPLICATE_GROUPS } from './expected-duplicate-groups.test-support';
import { EXPECTED_PENDING_SOURCES } from './expected-pending-sources.test-support';
import { supabaseHistoryReplayManifest } from './supabase-history-replay-manifest';

const MAPPINGS = [
  [
    '20260623190041',
    '20260623190000_enable_realtime_negotiation_requests.sql',
    'bc2165173828d7a5c667e5a7415fb37b9ba7762aad2e12268b70eab6dcc94526',
    'canonical',
  ],
  [
    '20260624211416',
    '20260624200000_merchant_email_domains.sql',
    '120e16cb8768fdec2e36ce041dc5049e299594d271e1f900a4abd0ac3c775ad6',
    'canonical',
  ],
  [
    '20260625173604',
    '20260714010000_scope_feature_settings_read_policies.sql',
    '31091717a01f66c683c87e77a2f62245732df023b6dd61055855cf7ff78cff9f',
    'superseded-final-state',
  ],
  [
    '20260626131520',
    '20260702024830_fix_search_products_condition_filter.sql',
    'd94d9d87b238c217a8640c9e5b2ef57263ff2112015fac7e2f40de2a91270ed3',
    'canonical',
  ],
  [
    '20260629154903',
    '20260714225501_reconcile_order_fulfillment_timestamps.sql',
    '1f6b9c1e12afbbab4e32a697230cebbe196fb9d43daf340caba1eb309370a361',
    'append-only-repair',
  ],
  [
    '20260630123511',
    '20260702063638_restore_mobile_admin_product_rpc_contract.sql',
    'a04858072ce04f37af2269bb14bd4a936df612b6243fdb0099e8b417ba9c3ba4',
    'superseded-final-state',
  ],
  [
    '20260701080400',
    '20260702140100_order_item_unit_costs_supplier_analytics.sql',
    'b2c0bd55fdb092549ccbc42ed4011def80cc2f5417451bba14df6476cdf4a8a9',
    'canonical',
  ],
  [
    '20260701123945',
    '20260702140200_supplier_purchase_analytics_branch_scope.sql',
    '722b166fda187ee2cf4d8200d1b99a4af88fd41055ab85ba5ece171bdd3a721c',
    'canonical',
  ],
  [
    '20260706202930',
    '20260706200000_add_storefront_preflight_rpcs.sql',
    '091506e1cfb83822453a2134eb01f9e72fe78dbcb988eafe01412e78fd72d021',
    'canonical',
  ],
  [
    '20260706210329',
    '20260706162109_allow_page_config_history_insert.sql',
    '3104462281e7e92658b25c36cbb21c95437da84babb6e18f95c45242adfa5594',
    'canonical',
  ],
  [
    '20260707064146',
    '20260706230000_add_blog_listing_preflight_rpc.sql',
    'e6f1050fa096534a442b1b19aad68039c577bb620bb897e5ece172a1e5c73a04',
    'canonical',
  ],
  [
    '20260708072653',
    '20260708013000_create_domain_purchase_transaction_rpc.sql',
    '40b5b16c32136c3fa8300725a48469d43af8264f60c4b1faa4fdc6a99e3f00e6',
    'canonical',
  ],
  [
    '20260708072825',
    '20260708013500_fix_domain_purchase_rpc_merchant_derivation.sql',
    '53eca111142dda0f4f5030deeec5842b9eabc588f894d631a1830eb8f7dad999',
    'canonical',
  ],
  [
    '20260708075932',
    '20260708090000_lock_domain_purchase_rpc_service_role.sql',
    '7d522c998d5b32c230fe804cc21ffa0daa23832d37661a490164cbc840ba6855',
    'canonical',
  ],
  [
    '20260708102643',
    '20260707211507_optimize_storefront_cached_merchant_and_variant_wrappers.sql',
    '2916e23dae09a40aa2e771798e3919ddea346f2ce8638837dd9a9de098b68e61',
    'canonical',
  ],
  [
    '20260708220832',
    '20260708220947_drop_authenticated_domain_purchase_rpc.sql',
    '005b89e87c87bcad7f5b206ad61cff05041458edd19f60409c73889ed7921bc9',
    'canonical',
  ],
  [
    '20260713200830',
    '20260713211500_split_platform_blog_anon_read_policy.sql',
    'd51de0171bb6837e4ed9fa161b1785de2d77915446d89cb2a857a0f403fa337f',
    'canonical',
  ],
] as const;

const PIPELINE_HASHES = `
4f31649ba4c9c3d6b5eb4110dbb0d144237502642d61c0606e15a9b1ba39556b 20260712150001_domain_event_pipeline_tables.sql
3a3018fcd2e0daea0dec918d953e1dadf314ea1f88698e336a72a97da8ddcd1c 20260712150050_eventing_internal_schema.sql
dcb23009b30f1970359737ccfc1e34f3b63b952a59e6854d1352a98b4fbdc21b 20260712150075_domain_event_idempotency_guard.sql
bce417899451c9bd0b5e18881b3776ecfcfb8128d2953d619c859e675c45cde1 20260712150100_domain_event_enqueue_rpcs.sql
10162654ecc524c5d0fafd8f6c08f2fa439a2cce791373a7dc5b05e4e94cffe7 20260712150101_analytics_domain_event_rpc.sql
a466608103ca395ac28582e30fcece53fb671b356e5422f9d58c6f5142a975e2 20260712150102_domain_event_read_rpc.sql
09b1bbb4ae19c13465a94250764e12539e3b6aabfb18f7a4d2190afa79d6695a 20260712150105_platform_domain_event_rpc.sql
45f445c112e1e76e1ff66ac0def33b6f9957c8b70e29f25dc5753860b55d41c1 20260712150106_ingress_replay_audit.sql
735db06e396e8fd235d8b410911c824b312e7fa6dd05edf74fef7eb166e7e85d 20260712150110_domain_event_routing_rpcs.sql
ae6d9af8d89034e2874c646a9d3ce76d84b93ea09e1aab16b84f7dab36f59819 20260712150111_domain_event_metrics_rpc.sql
f443ec53e6c087db9cae6d80904a2042cfdbeaee36f94acfee341fc679ab9d82 20260712150115_event_delivery_replay_audit.sql
7930f4e4d57cd264edf72a4e61ecea2309d60c629bc6267026721ab9535ac6b9 20260712150120_event_delivery_rpcs.sql
9efc932c818fe40f501a261399dbccf1e5146b0ec8e40050e0d4f0671e6c7f2c 20260712150121_event_delivery_replay_rpc.sql
6809f521ff5a08934f44e9c76626d4b978e9630413421b08f39788292f15ed60 20260712150122_event_delivery_batch_replay_rpc.sql
9c5865a13cc5c75f9b31183ea599fc8d51296d0c2c71cc9ae430120f69a1ab04 20260712150125_event_worker_heartbeats.sql
85897415c4352831b9e2cd48a3f2784e892c1e7316bdfccfa207482cef48e78e 20260712150126_event_pipeline_admin_rpcs.sql
43a75c9243d6232102e7462842e7a8f3d2459410434cad8630da787c170560a5 20260712150130_domain_event_cdc_triggers.sql
11cb7190bd506ac7460170bcf2a18701eae227eb21292426d9b5e1c55741d031 20260712150140_event_pipeline_retention_rpc.sql
6718cca7ae1f9dde88f0f6645be29b093025f6dbffeda1e4e006fca6108682a0 20260713113000_preserve_delivery_context_in_domain_events.sql
60d7beb0f4cbb42de43046648dd44413a8dedf96559b7bd171f8a121eea69cf1 20260713120000_event_delivery_replay_and_idempotency_fixes.sql
708770981937505e9d27e2196d99346d38ef745abf19abd253a350aec4a234aa 20260713205000_separate_delivery_replay_attempt_budget.sql
427eb53af01548ae594013b71827324a544b3ffe37a41b302b74c1c386178457 20260713222000_platform_event_legacy_idempotency.sql
bfda81c357bff06435de481c993011652e173795d2497a5fde63e46c23102dca 20260714000100_harden_event_pipeline_admin_filters.sql
619481d348cd55b38a5043f3ac003f39715887808328f96335ea4a2fa989e994 20260714000200_scope_public_event_ingress.sql
c429a6a71fec0487645b47f312998a25f14ec2af4c2741ce3de6b7b36b9356cf 20260714000300_allow_tenant_verified_event_ingress_fallback.sql
fbf3de3af3099d6624d3367bfd91d9bc49435487c78670e2efc202e2456a18d2 20260714000400_drop_legacy_event_ingress_rpc_overloads.sql`.trim();

describe('supabaseHistoryReplayManifest', () => {
  it('binds post-replay migrations without changing the frozen base', () => {
    expect(
      supabaseHistoryReplayManifest.postReplaySources.map(
        ({ repositoryPath }) => repositoryPath
      )
    ).toEqual([
      'supabase/migrations/20260718070000_credit_direct_missing_confirmation_review.sql',
      'supabase/migrations/20260718070001_record_credit_direct_client_completion.sql',
      'supabase/migrations/20260718070002_bound_credit_direct_pending_cleanup.sql',
      'supabase/migrations/20260718070003_allow_credit_direct_tracking_token_with_session.sql',
      'supabase/migrations/20260718070004_validate_credit_direct_review_issue.sql',
      'supabase/migrations/20260718070005_backfill_credit_direct_missing_confirmation_review.sql',
      'supabase/migrations/20260718070006_harden_credit_direct_client_completion.sql',
      'supabase/migrations/20260718070007_supersede_credit_direct_completed_references.sql',
      'supabase/migrations/20260718070008_preserve_credit_direct_payment_audit_notes.sql',
      'supabase/migrations/20260718070009_scope_credit_direct_payment_audit_notes.sql',
      'supabase/migrations/20260718070010_preserve_credit_direct_provider_reference.sql',
      'supabase/migrations/20260718070011_require_credit_direct_guest_tracking_token.sql',
    ]);
    expect(
      supabaseHistoryReplayManifest.postReplaySources.every(({ sha256 }) =>
        /^[a-f0-9]{64}$/.test(sha256)
      )
    ).toBe(true);
  });

  it('hash-binds pending migrations without treating them as deployed', () => {
    expect(supabaseHistoryReplayManifest.pendingSources).toEqual(
      EXPECTED_PENDING_SOURCES
    );
  });

  it('binds the base registry and 125-file bootstrap receipt', () => {
    expect(supabaseHistoryReplayManifest.baseSha).toBe(
      '9e3d1b14b1931a5e441fc23f0e5417c188056e47'
    );
    expect(supabaseHistoryReplayManifest.baseRegistry).toEqual({
      fileCount: 424,
      uniqueVersionCount: 422,
      tailVersion: '20260714225500',
    });
    expect(supabaseHistoryReplayManifest.bootstrap).toEqual({
      count: 125,
      receiptSha256:
        '06e17f84a563e147b290e90a307d269518d73d6452013fbe87570ee0fa70680e',
      tailPath:
        'supabase/migrations/20260525060558_normalize_ogabassey_encoded_blog_slug.sql',
      tailSha256:
        '1de67f610fb29831ffb2606eb1b227d0d4e1708b21860282ebce5aba762c3293',
    });
  });

  it('binds the replay-only transform without changing migration history', () => {
    expect(supabaseHistoryReplayManifest.transforms).toEqual([
      {
        originalSha256:
          '2b1ebac0ab9514d5b6c91e0ebf4543e3470b9fa71b0a80ab0746c9cccc9a4c41',
        outputSha256:
          '6f6444120e4cefe5febaba935ea70e7a304bf2d330702afc838d4ab70a77b9d8',
        overlayPath:
          'supabase/tests/migration_history_overlays/20260525140048_quiz_authoritative_answer_scoring.sql',
        replacement: 'extract(epoch FROM (pg_catalog.now() - v_issued_at))',
        repositoryPath:
          'supabase/migrations/20260525140048_quiz_authoritative_answer_scoring.sql',
        search:
          'pg_catalog.extract(epoch FROM (pg_catalog.now() - v_issued_at))',
      },
    ]);
  });

  it('binds all 17 production-only mappings', () => {
    expect(
      supabaseHistoryReplayManifest.productionMappings.map((mapping) => [
        mapping.productionVersion,
        mapping.repositoryPath.replace('supabase/migrations/', ''),
        mapping.sha256,
        mapping.rule,
      ])
    ).toEqual(MAPPINGS);
  });

  it('binds the two physical duplicate groups', () => {
    expect(supabaseHistoryReplayManifest.duplicateGroups).toEqual(
      EXPECTED_DUPLICATE_GROUPS
    );
  });

  it('binds all 26 immutable event-pipeline migrations', () => {
    const actual = supabaseHistoryReplayManifest.pipelineSources
      .map(
        ({ repositoryPath, sha256 }) =>
          `${sha256} ${repositoryPath.replace('supabase/migrations/', '')}`
      )
      .join('\n');
    expect(actual).toBe(PIPELINE_HASHES);
  });

  it('binds the provenance, alias receipt, and applied repair source', () => {
    expect(supabaseHistoryReplayManifest.provenance).toEqual({
      evidenceSourceCount: 25,
      exceptionalRecordCount: 31,
      path: 'apps/web/tools/db/fixtures/production-effect-provenance.json',
      relationCount: 9,
      schemaVersion: 5,
      sha256:
        '1f1e4e3112a0010dbed91a25a8185d38fcfd4cf56d2d2b60ca76306bbbb100e1',
    });
    expect(supabaseHistoryReplayManifest.aliasReceipt).toEqual({
      path: 'apps/web/tools/db/fixtures/migration-name-alias-deploy-repair.json',
      sha256:
        'ba97d2e25bb8d2f43e0a4fdfdb1fa37586fd9c7397458fa8dc0c0c5858288ade',
    });
    expect(supabaseHistoryReplayManifest.repair).toEqual({
      body: 'ALTER TABLE public.orders\n  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,\n  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;\n',
      path: 'supabase/migrations/20260714225501_reconcile_order_fulfillment_timestamps.sql',
      sha256:
        '1f6b9c1e12afbbab4e32a697230cebbe196fb9d43daf340caba1eb309370a361',
    });
  });

  it('binds the ordered forward repairs outside production provenance', () => {
    const { forwardRepairs } = supabaseHistoryReplayManifest;

    expect(forwardRepairs).toEqual([
      {
        changedComponent: {
          category: 'function',
          identity:
            'eventing.resolve_domain_event_duplicate_v1(p_producer text, p_trust_level text, p_idempotency_key text, p_external_event_id text, p_event_name text, p_subject_type text, p_subject_id text, p_merchant_id uuid, p_data jsonb)',
        },
        path: 'supabase/migrations/20260714225502_reconcile_domain_event_duplicate_jsonb_operator.sql',
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
        path: 'supabase/migrations/20260714225503_reconcile_customer_order_cancellation_reason.sql',
        reason: 'reconcile_cancellation_reason_and_execute_acl',
        sha256:
          '6c5f9ca9ed75b63e241f25e1dddfab9b2d7da1bab7cb91694b92a1d9548d7a71',
      },
    ]);
  });
});
