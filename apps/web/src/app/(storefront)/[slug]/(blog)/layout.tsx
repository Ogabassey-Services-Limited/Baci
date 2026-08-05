import '@/app/(storefront)/storefront-blog.css';
import type { ReactNode } from 'react';

// The shared [slug] layout resolves request-bound tenant routing before this
// statically generated leaf renders. Next.js can otherwise validate the leaf
// independently, encounter the parent request boundary, and surface its
// NEXT_STATIC_GEN_BAILOUT control-flow signal as a Lambda error. The blog page
// owns its static shell through its existing Suspense fallback, so opt only
// this route group out of instant shell validation.
export const unstable_instant = false;

export default function StorefrontBlogCssLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
