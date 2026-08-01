// Expected PENDING replay sources, extracted from the manifest test (Codex #3171)
// so the binding test stays under the 300-line modularity gate. Independently
// hand-verified against supabase-history-replay-sources.ts PENDING_SOURCES.
import { AUDIT_PENDING_SOURCES } from './expected-pending-audit-sources.test-support';

export const EXPECTED_PENDING_SOURCES = [
  {
    repositoryPath:
      'supabase/migrations/20260721093205_harden_paid_order_completion_and_side_effect_retries.sql',
    sha256: 'e8398b0b10a5e9d199707bcceb5835f865bfce85dd4732e9bc46fc4e13d16d29',
  },
  {
    repositoryPath:
      'supabase/migrations/20260721093206_merchant_order_cancellation_audit.sql',
    sha256: 'b36447107978f1612b0f158bbd3331f635bf8bd940ec0ff01545ecba765a753b',
  },
  {
    repositoryPath:
      'supabase/migrations/20260721093207_order_cancellation_side_effect_claims.sql',
    sha256: '399dfc28247c2f3d3c720783eeb13c3376a1b207f7ea1095e66366e919f1e5ea',
  },
  {
    repositoryPath:
      'supabase/migrations/20260721140000_forward_harden_merchant_order_cancellation.sql',
    sha256: '46efbde5a4a1f241ad0bc829edac60ecbbee156187f5d4f7975f3b6aabb9693b',
  },
  {
    repositoryPath:
      'supabase/migrations/20260721140100_forward_harden_cancellation_side_effects.sql',
    sha256: '1fa573e186b486ade1ae4bc628969a74c37ee01f850cf7ab4d60ac3a40fad8a8',
  },
  {
    repositoryPath:
      'supabase/migrations/20260721150000_quiz_leaderboard_bounded_and_self.sql',
    sha256: '9e16adac5b0653fbd27814b5af40d5dd170d11da3ff852970ea47735b9451bbd',
  },
  {
    repositoryPath:
      'supabase/migrations/20260722150000_s1_merchants_authenticated_containment.sql',
    sha256: '3fdc876b7699184efe079f9d9412301eac3b893aefc193868baef6e9bb448d76',
  },
  {
    repositoryPath:
      'supabase/migrations/20260723000001_merchant_payment_credentials.sql',
    sha256: '67f823ff2e8758874e04d1e66365995dcf10840cf8e4db1180164e848afcc95e',
  },
  {
    repositoryPath:
      'supabase/migrations/20260723000002_byok_direct_settlements.sql',
    sha256: '4127cea6c8c3b54f96c7cc051817100ec4c2cc536592cee670eef18ea921e330',
  },
  {
    repositoryPath:
      'supabase/migrations/20260723000003_paypal_capture_persist_reconciliation_issue.sql',
    sha256: 'dda2363ed20ac43cf85923f54280f26033479337e33f358149c6eae04432529c',
  },
  {
    repositoryPath:
      'supabase/migrations/20260723000004_delete_merchant_payment_credential_role.sql',
    sha256: '0308b957a622c68bfa02f79dacda3243b61b678b91fdb20f4d3accb4994d3a73',
  },
  {
    repositoryPath:
      'supabase/migrations/20260723000005_orders_paid_transaction_marker.sql',
    sha256: '0b4f1455a50879471e899afeecdaefb0b03e1e1a7b5657c571cd400d7e8a6c5d',
  },
  {
    repositoryPath:
      'supabase/migrations/20260723000006_orders_paid_transaction_marker_index.sql',
    sha256: '6b2f4f4139702abcd5be077a069769114d47b7f0302a7c4d69d8b6441007df51',
  },
  {
    repositoryPath:
      'supabase/migrations/20260723000007_credit_customer_wallet_order_refund.sql',
    sha256: 'd34e31e49b9d5a7ea3a2631d7a29d45a06e5cc0db76ce80019ea2a02dad4519e',
  },
  {
    repositoryPath:
      'supabase/migrations/20260723000008_touch_merchant_credential_validated_by_environment.sql',
    sha256: '59247745bfa511c70e4c4d0bfdb26abc8652c5565ef9e994c1a29247deee8f1b',
  },
  {
    repositoryPath:
      'supabase/migrations/20260723000009_public_snapshot_paypal_flags.sql',
    sha256: 'f2fe9d9345c4728a1a34f8cd44e6f1456fae2f18d88da6f7449cefce8d0a1de8',
  },
  {
    repositoryPath:
      'supabase/migrations/20260723000010_transactions_refund_statuses.sql',
    sha256: '951c980acd5d98a49d10160e0d830b50bfe9c9c7ed33585dce2327bdd4b8d986',
  },
  {
    repositoryPath:
      'supabase/migrations/20260723000011_transactions_refund_pending_index.sql',
    sha256: 'f74bd1af1d8237976468e4df510b577e8b4de0947ba117fe9abb36cac6811e51',
  },
  {
    repositoryPath:
      'supabase/migrations/20260723000012_include_paypal_capture_persist_review_type.sql',
    sha256: '6f396c1d148a7971eaf4eaaea4e896211569f3b536fd65d71ea296fa63ccfcb5',
  },
  {
    repositoryPath:
      'supabase/migrations/20260723000013_replace_merchant_payment_credential_pair.sql',
    sha256: '33d873748cd948a92c4cb32d2f12d3dba06670810fd4dc9b735fc54dac8ea0cc',
  },
  {
    repositoryPath:
      'supabase/migrations/20260723000014_mark_savings_redemptions_reversed.sql',
    sha256: 'fd3391ef880d88b3b2f7083888a43099476489b52f6311dd004151efbebfe66d',
  },
  {
    repositoryPath:
      'supabase/migrations/20260723000015_drop_legacy_credential_validation_touch.sql',
    sha256: 'cd91c66fed1a158455c83928e4eae42d3f3dd8a1db826c235e68857e689049fb',
  },
  {
    repositoryPath:
      'supabase/migrations/20260723000016_mark_paypal_transaction_refunded.sql',
    sha256: '6078df1576ec4ea3c94d565a6180242a688186c5e8e25ef943bb23144e6fa3c7',
  },
  {
    repositoryPath:
      'supabase/migrations/20260723000017_order_payment_snapshot_merchant_country.sql',
    sha256: '6bb7429b5f50c4116febc9c5c41cd1244105b9d0852944954825c6139ea64718',
  },
  {
    repositoryPath:
      'supabase/migrations/20260723000018_byok_fee_accrual_ledger.sql',
    sha256: 'de216327cc42bd2a1814771969823be8b598a3d00f4504e313a250e3f1baf5d0',
  },
  {
    repositoryPath:
      'supabase/migrations/20260723150000_merchant_payment_secret_rpcs.sql',
    sha256: '36b7e8bb66b30691e633e312c8dbfea3bfee10a945007a59f0bfb8f5599991fe',
  },
  {
    repositoryPath:
      'supabase/migrations/20260723160000_admin_merchant_profiles_rpc.sql',
    sha256: '28db4728fe8661bcd8083fa9bbd93b63a04c279c657b7f228d0c39cfca685e0a',
  },
  {
    repositoryPath:
      'supabase/migrations/20260723210000_scope_subaccount_rpc_staff_permission.sql',
    sha256: '9df49e0051a16c29e444513ad5bc2786c2420560071da5f02d8f249fc38616d0',
  },
  {
    repositoryPath:
      'supabase/migrations/20260724000001_deep_merge_get_staff_permissions.sql',
    sha256: 'b4fbc631b272f314b2c15f47f8bb59b3bbdea5583b620153a67f3915bf321918',
  },
  {
    repositoryPath:
      'supabase/migrations/20260724000002_reject_staff_merchant_credential_writes.sql',
    sha256: '5b48e521ddc688c4694394c2c1f1c30ab01266951d3681f5d56cd2d6488c5ca0',
  },
  {
    repositoryPath:
      'supabase/migrations/20260724090000_s1_pr2b_revoke_payment_secret_column_grants.sql',
    sha256: '2a8e2b69b99fb69c2cbed3bd43f55218f15919951103163e525f0d87f696ed1d',
  },
  {
    repositoryPath:
      'supabase/migrations/20260724100000_s2i_contain_credit_direct_public_mutation.sql',
    sha256: 'a0f4d9cbfb59bb5df9d9a658bbe21e3f1753cad20532acf87aa4b5e784df66c5',
  },
  {
    repositoryPath:
      'supabase/migrations/20260724100100_s2p_credit_direct_checkout_tokens.sql',
    sha256: 'e1ac8338dd870606df93984f8193d71b4ef66b72a2ef4440710a3ffcd9c4bea6',
  },
  {
    repositoryPath:
      'supabase/migrations/20260724100200_s2p_harden_set_credit_direct_session.sql',
    sha256: 'cb454256cc5497a2073a38f85bf9ab5c7cc8f317a4779765829d793787c1e6a0',
  },
  {
    repositoryPath:
      'supabase/migrations/20260724120000_order_scoped_receipt_bank_details_rpc.sql',
    sha256: 'd94773042e415b149f6c66615aaf2a668af386c6a529e324f7cc2287cdcbb5f2',
  },
  {
    repositoryPath:
      'supabase/migrations/20260724130000_add_customers_date_of_birth.sql',
    sha256: 'aaa12834a752011d2c417f3f7b2e3ff7a1efdec7e58e265a898ceea0a3bc7b5d',
  },
  {
    repositoryPath:
      'supabase/migrations/20260724140000_merchant_balance_gateway_origin_guard.sql',
    sha256: '8b794c4535b8a5f2acf674fbeb78037aeb518591e03b72bd2106efa4454e63f4',
  },
  {
    repositoryPath:
      'supabase/migrations/20260724150000_set_customer_date_of_birth_rpc.sql',
    sha256: '77755c5f154ca7ccef73b2e0a2e68f9a5cf4cc9f1284a6489bb6d16d1c18d999',
  },
  {
    repositoryPath:
      'supabase/migrations/20260724160000_korapay_storefront_setting_default_off.sql',
    sha256: '76ccee1969b595892e70322b5957fe03b6df444952d9f1b6bb9c1e59ffc55556',
  },
  {
    repositoryPath:
      'supabase/migrations/20260725120000_guard_customer_dob_soft_delete.sql',
    sha256: 'c1e76853223a105701c2ef28c2a7a1211508af13a7b27d12393590454b36bcd8',
  },
  {
    repositoryPath:
      'supabase/migrations/20260725164445_restore_merchant_owner_row_select_branch.sql',
    sha256: '9823a697f756bb2865a5de62d2a202d2bf348b284ead1d5cee9c6838a477ca27',
  },
  {
    repositoryPath:
      'supabase/migrations/20260726103000_atomic_category_hierarchy_lifecycle.sql',
    sha256: '0edb40c674e426a144b2ab9e7de455a307a0f3920193576867e4df8bc1041da2',
  },
  {
    repositoryPath:
      'supabase/migrations/20260726110000_add_merchant_signup_policy_health_rpc.sql',
    sha256: '767937b88573d95bfaacb4777082d4955aca38c3c41b8aa2dee0e5787bcce6bb',
  },
  {
    repositoryPath:
      'supabase/migrations/20260726201000_harden_category_hierarchy_lifecycle.sql',
    sha256: '57037c2a309da200410ddbb167cd58183f9a3977a9c285815f5d81af99fbc5c3',
  },
  {
    repositoryPath:
      'supabase/migrations/20260727033000_cache_invalidation_outbox.sql',
    sha256: '429d8681f42744b359cde853299cc7d0272238848c5147e228dce86e2c570d81',
  },
  {
    repositoryPath:
      'supabase/migrations/20260727090000_correct_cache_invalidation_outbox.sql',
    sha256: '43c66d01aae976aa4c755cd591f8d22405da5aa0a4cd95d64f57501859e7e680',
  },
  {
    repositoryPath:
      'supabase/migrations/20260727105959_archive_cross_tenant_product_category_memberships.sql',
    sha256: '4ef89a73c4b71df4a7187ff61091de5447a3d500142c024fc82969cc79c5c1a6',
  },
  {
    repositoryPath:
      'supabase/migrations/20260727110000_complete_cache_invalidation_trigger_coverage.sql',
    sha256: 'fdb1e8751714cc7eff59ae88a1452e9c1cf62292bac817c30865fee716a0bbc3',
  },
  {
    repositoryPath:
      'supabase/migrations/20260727150000_exact_product_and_feature_cache_invalidation.sql',
    sha256: '5e32cabd902912727ade703ae12c5a9b563513cbf5e0659efeda662b0c622810',
  },
  {
    repositoryPath:
      'supabase/migrations/20260727170000_fix_cache_invalidation_outbox_fairness.sql',
    sha256: '95996acb8eeb804f8c63e817731fdd106955b5974cf83044784efe53b0891be8',
  },
  {
    repositoryPath:
      'supabase/migrations/20260727170936_add_product_offer_and_key_spec_cache_invalidation.sql',
    sha256: '0c08f39e96aaefad73ede1037402107c8944b19398eafcb88027e614b3c7b10d',
  },
  {
    repositoryPath:
      'supabase/migrations/20260727184356_enforce_ordered_exact_cache_and_membership_ownership.sql',
    sha256: 'd4c7e5484a34f6496bd749f381e8b647762e975bfd1e9598e2a58fd515b99d38',
  },
  {
    repositoryPath:
      'supabase/migrations/20260727185139_preserve_exact_product_identifier_case.sql',
    sha256: '35225e92f3841ea6a1e802efb3acae85ed2720ba6ddf33e5839976cda7c44a89',
  },
  {
    repositoryPath:
      'supabase/migrations/20260727195209_allow_platform_admin_read_product_category_archive.sql',
    sha256: '2f3f56e70ad024272a6a0c3fc5b4c0ffc472f29e259319a4e1631acc4667c65a',
  },
  {
    repositoryPath:
      'supabase/migrations/20260728091958_provision_mobile_merchant_v2.sql',
    sha256: '9e4df9812810ef2c7e0659a238390d6c97222b2891454ba00740ddbff6cc6104',
  },
  ...AUDIT_PENDING_SOURCES,
  {
    repositoryPath:
      'supabase/migrations/20260731140000_payment_ingress_contract_generation_foundation.sql',
    sha256: '1a390474d12890e9f641c72f743b35669798eee56a887a87720f4bd8b53a1705',
  },
  {
    repositoryPath:
      'supabase/migrations/20260801140000_payment_ingress_contract_companion.sql',
    sha256: '0bf00675591a01c8c60132dd51e314f2c9fb05458a779b38db82c39a9595d226',
  },
];
