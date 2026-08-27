// Keep recently added identity and analytics migrations separate so the
// complete manifest binding remains below the repository's 300-line cap.
export const RECENT_PENDING_SOURCES = [
  {
    repositoryPath:
      'supabase/migrations/20260729195915_guard_merchant_social_media.sql',
    sha256: '54a9e1448588945f4fae6a758740ecf48be61e7536962438accf7c02cca854a3',
  },
  {
    repositoryPath:
      'supabase/migrations/20260730084051_repair_merchant_identity_guard_paths.sql',
    sha256: '960cae13fc8c97e50624cd1b4fc53fa785c7044f0dc233d87c6a057ffce82a28',
  },
  {
    repositoryPath:
      'supabase/migrations/20260730103000_enforce_merchant_updated_at_occ.sql',
    sha256: '3f6ca1a9570f072d934f7bcb8b7887371ccb3541b4e46d5c252e49102fedf1b5',
  },
  {
    repositoryPath:
      'supabase/migrations/20260730110031_skip_unchanged_guarded_social_updates.sql',
    sha256: '9be059cba5547494ce4f0db9220d8852d1bbe55a33f4ff327fa1dc7980d6b77e',
  },
  {
    repositoryPath:
      'supabase/migrations/20260730132000_add_scoped_merchant_analytics_config.sql',
    sha256: '883a1207a4aba986f59e4135dcdb932abc0965611eed016a331bf684cd68b47b',
  },
  {
    repositoryPath:
      'supabase/migrations/20260730144747_add_merchants_updated_at_trigger.sql',
    sha256: '621055c391934618eb5d45706bcc07894f772207507841cba0c22b45b2f97bf5',
  },
  {
    repositoryPath:
      'supabase/migrations/20260731190000_atomic_blog_post_product_links.sql',
    sha256: 'c0985aea612ecbd611213f7177b042c066c59cdac455f75ff162d3c32701a275',
  },
  {
    repositoryPath:
      'supabase/migrations/20260801000000_add_blog_post_product_position.sql',
    sha256: '59b08d027520cec131aabc6434b26174baa714b9e7407a316abd1781bae31343',
  },
  {
    repositoryPath:
      'supabase/migrations/20260801000500_preserve_legacy_blog_product_position_inserts.sql',
    sha256: '33c220545d2af71a65ca8647273997bdbf692bc505ecbceebb70011c17be4e10',
  },
  {
    repositoryPath:
      'supabase/migrations/20260811090000_repair_shipment_tracking_generation_order_id_ambiguity.sql',
    sha256: 'f50772f7fb481dc232078f4b87a8031ab746674e7ecd5fcf2bccb3099519b376',
  },
  {
    repositoryPath:
      'supabase/migrations/20260821171051_google_ads_connections_and_spend.sql',
    sha256: '1994ba5d58f278013d01a6b5f8ba0871f980a0f7223c0321875d4d5013df3c05',
  },
  {
    repositoryPath:
      'supabase/migrations/20260821174945_google_ads_secret_rpcs.sql',
    sha256: '6462c129ad02b0745800bad0ccbd81e6edb09b4af853c5de05bf0c1befc464b2',
  },
  {
    repositoryPath:
      'supabase/migrations/20260821180000_provider_neutral_ads_storage.sql',
    sha256: '1bc92dcee4cef48f4a30747ee378c81c3f0483e573d159df3b367bf7edee632d',
  },
  {
    repositoryPath:
      'supabase/migrations/20260821180001_harden_provider_neutral_ads_rpcs.sql',
    sha256: 'c5dc059fe41ebed2824b0d9b6275bd8d58b691c5cb561fc039bb80348834d563',
  },
  {
    repositoryPath:
      'supabase/migrations/20260821180002_meta_ads_reauth_status.sql',
    sha256: 'f0c8ee6d1f3b7b3e2eb06380c8be94fe797ed9781c1ba00d59b49ea1836b589c',
  },
  {
    repositoryPath:
      'supabase/migrations/20260821180003_expand_meta_ads_reauth_reason_allowlist.sql',
    sha256: '4312b9ad198bd16bb8bf20191e786e24a34a97f928da5e9031399f6a7da47960',
  },
  {
    repositoryPath:
      'supabase/migrations/20260821180004_snapchat_ads_oauth_and_disconnect.sql',
    sha256: 'eac8c22a9d2d2ad1decbde111f60921b880cf478f4123d3441b5e0e291ccb3ca',
  },
  {
    repositoryPath:
      'supabase/migrations/20260821180005_snapchat_ads_atomic_refresh_tokens.sql',
    sha256: 'c71e54d8a1ea2af6809ecc50d6e6582358806501eb851f17861dfab611f10359',
  },
  {
    repositoryPath:
      'supabase/migrations/20260821180006_provider_neutral_ads_oauth_state_nonces.sql',
    sha256: '7def866f396dced9ceb5c914e67b640c3765e25d9c59032bae78f10fa31d4dc3',
  },
  {
    repositoryPath:
      'supabase/migrations/20260821180007_harden_provider_neutral_ads_oauth_state_nonce_rpcs.sql',
    sha256: '55d645a37189cf63da021741d225888f6eb867c92f07bb0d05ffc3ee28b96f45',
  },
  {
    repositoryPath:
      'supabase/migrations/20260823190000_harden_ads_review_findings.sql',
    sha256: '3ba9981390574c940e3d90fb0ac3991bce39cb9625f5d0e31e2c185c88bbb56f',
  },
  {
    repositoryPath:
      'supabase/migrations/20260823200000_google_ads_reauth_status.sql',
    sha256: '7cc5b5c148990cb0cc0b7cb8ed98c6fe374dcc43fd3e7fef5db91c6563c92332',
  },
  {
    repositoryPath:
      'supabase/migrations/20260823210000_google_ads_reauth_clear_account.sql',
    sha256: 'dc328a575fba02e3fd64e470bcc328e27152d183e8c572f27c79d338e40e652d',
  },
  {
    repositoryPath:
      'supabase/migrations/20260823220000_google_ads_sync_consistency.sql',
    sha256: '70cf6954955961e3fcd923aac9c2512e54062ef5936d51c066faa3db23caeca3',
  },
  {
    repositoryPath:
      'supabase/migrations/20260824090000_replace_social_ads_spend_window.sql',
    sha256: '2e34f6488ad7bcd213fe9c08adf0353b789d7c6e0f017928276d64cd42cb5a5e',
  },
  {
    repositoryPath:
      'supabase/migrations/20260824100000_require_analytics_permission_for_ad_spend.sql',
    sha256: '822bf6c91081f0b36cd0568d85cd5f500bb91182d36d5fb9b35ba72e3491cde7',
  },
  {
    repositoryPath:
      'supabase/migrations/20260824110000_account_aware_ads_sync_marker.sql',
    sha256: '7b693e30176a0c500614d933161ba7e6dd03ec0468e250a3a99ac7d618c7b7b3',
  },
  {
    repositoryPath:
      'supabase/migrations/20260825130000_index_snapchat_ads_oauth_state_nonce_fks.sql',
    sha256: 'e263dd84295faaba4aec24536626ea3040f972e1b36339e962a7adb864143182',
  },
  {
    repositoryPath:
      'supabase/migrations/20260825150000_compare_and_set_ads_account_selection.sql',
    sha256: '318e0edccd8da2bf844bca55a60760cb96e1d9b04fc88b6bfc081c933a4cfc22',
  },
  {
    repositoryPath:
      'supabase/migrations/20260825160000_bind_social_ads_spend_replacement_account.sql',
    sha256: '60a4613a121a6e24666a2d99c34a737d68934fd824c2ba20b50ef3a542ed1fc5',
  },
  {
    repositoryPath:
      'supabase/migrations/20260825180000_restrict_ads_spend_replacement_to_service_role.sql',
    sha256: 'ada11f24b76ccbef17e39cb84fe009f00f617a7727973a4bf17fb586fcc3a6a8',
  },
  {
    repositoryPath:
      'supabase/migrations/20260825183000_authorize_server_ads_spend_writes.sql',
    sha256: 'd3f849afe90cc671e19e18968538dabda817a266549d9f2d9e18751faf49af14',
  },
  {
    repositoryPath:
      'supabase/migrations/20260825184500_make_social_ads_upsert_internal.sql',
    sha256: 'a5bb531d9d44d71af6bbe821e41efef929c2cb56c3146797c5b588b30ddc2877',
  },
  {
    repositoryPath:
      'supabase/migrations/20260825190000_bulk_inventory_forecast_dashboard.sql',
    sha256: 'd38466b8daa79ac75dd96d0ee5e52039c62074cfaabf1ee326cbf3fb7f9f9a03',
  },
  {
    repositoryPath:
      'supabase/migrations/20260825191000_revoke_legacy_google_ads_spend_upsert.sql',
    sha256: '313610b5bae49c42960a4ac516230f02227eaec78a601c31e8edc41f5fc04c75',
  },
  {
    repositoryPath:
      'supabase/migrations/20260826090000_restrict_ads_credential_rpcs_to_service_role.sql',
    sha256: 'a191c7045cb7e2efe1a160f0d7656f0cd433feb9a43f00fa48801fd1ffe91ca1',
  },
  {
    repositoryPath:
      'supabase/migrations/20260827110000_retire_snapchat_disconnect_spend_rpc.sql',
    sha256: '08c2b4e066a77294c8f3515a904beac9861e9273c2d7d856e5254d749dfb159a',
  },
  {
    repositoryPath:
      'supabase/migrations/20260827110100_preserve_zero_inventory_threshold.sql',
    sha256: 'a8fcac98895d9114ceef91a9dce08d461d63fe9b36ebd651686f61297eabdcb0',
  },
  {
    repositoryPath:
      'supabase/migrations/20260827110200_restore_inventory_forecast_effective_stock_priority.sql',
    sha256: 'be508f6123591624d3296d770a011f3ac6a4c4838ad10ad74f870a07aef2a2cd',
  },
  {
    repositoryPath:
      'supabase/migrations/20260827110300_restore_snapchat_refresh_state.sql',
    sha256: '3b12e4ae8b95685d7641dbc141d98df2ed188e2777b02de2234d43aedbae8dc6',
  },
  {
    repositoryPath:
      'supabase/migrations/20260826150000_restrict_ads_connection_select_to_view_permission.sql',
    sha256: 'c2b4d82902c24edb2f3d17b001c4646c9db787f92fa28ab0912a279b40f71c65',
  },
  {
    repositoryPath:
      'supabase/migrations/20260826160000_prioritize_out_of_stock_inventory_forecast.sql',
    sha256: '446ea5fe68b2d140405d810527ff8c5b8005b3ac73a607dfe85911a20c58b13b',
  },
  {
    repositoryPath:
      'supabase/migrations/20260827010000_use_effective_inventory_forecast_stock.sql',
    sha256: 'e2812d6c8e27dca4e546453d9ae80a8096d82f2602b741fd3408d320a144ab03',
  },
  {
    repositoryPath:
      'supabase/migrations/20260827020000_prioritize_inventory_status_before_limit.sql',
    sha256: 'f5bc90b0820af8924481b6518ee7949bedb6d73396a7522d8f8c4d24a47272db',
  },
  {
    repositoryPath:
      'supabase/migrations/20260827030000_mark_ads_sync_started.sql',
    sha256: '66d40ffc1bf3c3b5b0c893e5e497f8469c720e740d07bc18d68a76e2c1e85c4f',
  },
  {
    repositoryPath:
      'supabase/migrations/20260827040000_allow_null_ads_reauth_cas.sql',
    sha256: '200fb297f08db945d7f7a185f669c60f147a338406371df3aeef32412d36d1b6',
  },
  {
    repositoryPath:
      'supabase/migrations/20260827100001_google_ads_reauth_missing_refresh.sql',
    sha256: 'd35b075406091766d009071449cd197c15e777f46d778f7d049c7939bf35fa21',
  },
];
