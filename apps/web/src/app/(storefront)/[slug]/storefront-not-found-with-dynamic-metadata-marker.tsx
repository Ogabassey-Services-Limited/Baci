import { notFound } from 'next/navigation';

// Missing product branches should hand off directly to the route not-found
// boundary. Valid page shells own the dynamic metadata marker after their body
// content so Next does not place metadata boundaries in not-found body slots.
export function StorefrontNotFoundWithDynamicMetadataMarker(): never {
  notFound();
}
