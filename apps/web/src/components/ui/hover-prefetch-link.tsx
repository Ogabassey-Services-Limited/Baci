'use client';

import Link from 'next/link';
import { type ComponentProps, useState } from 'react';

type HoverPrefetchLinkProps = Omit<ComponentProps<typeof Link>, 'prefetch'>;

/**
 * A Next.js `<Link>` that opts into prefetch only after the pointer enters it.
 *
 * The App Router's `prefetch={false}` disables BOTH viewport and hover prefetch,
 * so links to dynamic routes (e.g. PDPs) then pay a full server render on click
 * against real-world TTFB. The documented middle path — `prefetch={active ? null
 * : false}` toggled on pointer enter — keeps the route out of the eager
 * viewport-prefetch budget (which competes with the current page's own LCP) while
 * still warming the target the moment the user shows navigation intent, so the
 * eventual click feels instant.
 *
 * `prefetch={null}` means "use the Router default" (auto), and `false` means "off".
 *
 * @see https://nextjs.org/docs/app/guides/prefetching
 */
export function HoverPrefetchLink({
  onFocus,
  onPointerEnter,
  ...props
}: HoverPrefetchLinkProps) {
  const [prefetchEnabled, setPrefetchEnabled] = useState(false);

  return (
    <Link
      {...props}
      prefetch={prefetchEnabled ? null : false}
      onPointerEnter={(event) => {
        setPrefetchEnabled(true);
        onPointerEnter?.(event);
      }}
      // Keyboard parity: tabbing onto the link signals the same navigation
      // intent as hovering it — without this, keyboard users always pay the
      // cold click.
      onFocus={(event) => {
        setPrefetchEnabled(true);
        onFocus?.(event);
      }}
    />
  );
}
