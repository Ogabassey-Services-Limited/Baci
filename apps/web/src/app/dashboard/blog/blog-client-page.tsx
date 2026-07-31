'use client';

import { useMerchant } from '@/hooks/use-merchant-client';
import { BlogClientContent } from './blog-client-content';
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

  const isServerMerchantActive = activeMerchant.id === merchant?.id;

  return (
    <BlogClientContent
      initialCounts={isServerMerchantActive ? initialCounts : undefined}
      initialPosts={isServerMerchantActive ? initialPosts : undefined}
      key={activeMerchant.id}
      merchant={activeMerchant}
    />
  );
}
