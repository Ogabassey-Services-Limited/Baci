import type { ReactNode } from 'react';

// EXPERIMENT (PDP LCP): the prior `await connection()` here forced the whole PDP
// route group request-bound to dodge a Next 16 PPR resume/metadata-boundary
// collision. With generateStaticParams prerendering concrete OgaBassey PDPs, the
// listed products are fully prerendered (no fallback loading shell), so this
// guard is being tested for removal to let the hero ship in the static shell.
export default function StorefrontPdpLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
