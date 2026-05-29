import { notFound } from 'next/navigation';
import { StorefrontDynamicMetadataMarker } from './storefront-dynamic-metadata-marker';

function StorefrontNotFoundTrigger(): never {
  notFound();
}

export function StorefrontNotFoundWithDynamicMetadataMarker() {
  return (
    <>
      <StorefrontDynamicMetadataMarker />
      <StorefrontNotFoundTrigger />
    </>
  );
}
