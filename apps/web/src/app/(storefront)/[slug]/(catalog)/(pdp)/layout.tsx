import { connection } from 'next/server';
import type { ReactNode } from 'react';

export default async function StorefrontPdpLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Cache Components does not support `dynamic = 'force-dynamic'`. Keep the
  // whole PDP route group request-bound from this hostless layout instead, so
  // Vercel cannot serve a stale prerendered loading shell before Next's metadata
  // boundary. Do not replace this with hidden DOM markers; those create resume
  // slots that can collide with internal metadata boundaries.
  await connection();

  return <>{children}</>;
}
