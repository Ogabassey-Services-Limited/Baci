import { notFound } from 'next/navigation';

// Product routes should hand off directly to the route not-found boundary.
// Keep this marker-free; page-level host placeholders have caused Next resume
// mismatches against internal metadata boundaries on Vercel.
export function StorefrontRouteNotFound(): never {
  notFound();
}
