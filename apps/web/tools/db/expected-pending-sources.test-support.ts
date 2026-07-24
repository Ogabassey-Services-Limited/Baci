// Expected PENDING replay sources, extracted from the manifest test (Codex #3171)
// so the binding test stays under the 300-line modularity gate. Independently
// hand-verified against supabase-history-replay-sources.ts PENDING_SOURCES.
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
    sha256: '9d982df889a769e4b945aabd716e7b3b69693130f10f8acd77931626bfb6b05c',
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
];
