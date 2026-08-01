'use client';

import { ActiveBlogClientPage } from '@/app/dashboard/blog/active-blog-client-page';
import { useMerchant } from '@/hooks/use-merchant-client';
import type { BlogClientPageProps } from './blog-client-types';

export type {
  BlogClientPageProps,
  BlogPost,
} from './blog-client-types';

export function BlogClientPage({
  merchant,
  initialPosts,
  initialCounts,
}: BlogClientPageProps) {
  const { merchant: selectedMerchant } = useMerchant();
  const activeMerchant = selectedMerchant ?? merchant;

  if (!activeMerchant) {
    return (
      <div className="space-y-6" role="alert">
        Merchant context is unavailable. Refresh and try again.
      </div>
    );
  }

  return (
    <ActiveBlogClientPage
      activeMerchant={activeMerchant}
      initialCounts={initialCounts}
      initialPosts={initialPosts}
      merchant={merchant}
    />
  );
}
