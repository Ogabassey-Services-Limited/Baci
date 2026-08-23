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
];
