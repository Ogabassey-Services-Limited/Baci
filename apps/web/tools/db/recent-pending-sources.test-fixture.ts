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
];
