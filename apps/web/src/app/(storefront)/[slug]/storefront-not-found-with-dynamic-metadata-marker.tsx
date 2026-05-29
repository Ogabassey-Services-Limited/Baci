import { notFound } from 'next/navigation';

// Product routes call `connection()` before they decide to 404. Do not render
// the dynamic metadata marker here; it caused Next resume mismatches on cached
// storefront pages by inserting metadata boundaries into body slots.
export function StorefrontNotFoundWithDynamicMetadataMarker(): never {
  notFound();
}
