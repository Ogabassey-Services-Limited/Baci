import Link from 'next/link';
import type React from 'react';
import { useStorefrontScopedRoute } from './use-storefront-scoped-route';

interface ScopedStorefrontLinkProps {
  children: React.ReactNode;
  className?: string;
  href: string;
}

/**
 * A `next/link` wrapper that automatically scopes its `href` to the current
 * merchant storefront's basePath. Use inside the builder/Puck renderer so
 * authored links like `/products` resolve to `/<merchant-slug>/products`
 * when the storefront is mounted under a path prefix.
 */
export function ScopedStorefrontLink({
  children,
  className,
  href,
}: ScopedStorefrontLinkProps) {
  const toScopedRoute = useStorefrontScopedRoute();

  return (
    <Link className={className} href={toScopedRoute(href)}>
      {children}
    </Link>
  );
}
