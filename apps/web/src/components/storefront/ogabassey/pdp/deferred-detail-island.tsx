import type { ReactNode } from 'react';
import { SafeHtml } from '@/components/ui/safe-html';
import type { Product } from '@/components/storefront/ogabassey/types';
import { sanitizeHtml } from '@/lib/sanitize';
import { stripHtmlTags } from '@/lib/sanitize-core';
import { OgabasseyPdpDeferredDetailClient } from './deferred-detail-island.client';
import { OgabasseyPdpDeferredRailsIsland } from './deferred-rails-island.client';
import { buildOgabasseyPdpDeferredProductPayload } from './deferred-product-payload';

interface OgabasseyPdpDeferredDetailIslandProps {
  product: Product;
  semanticSections?: ReactNode;
  serverPrimaryDetails?: ReactNode;
  storeSlug: string;
}

function hasRenderableDescriptionContent(description: string) {
  const sanitizedDescription = sanitizeHtml(description, {
    forceLazyImages: true,
    headingLevelOffset: 1,
  });
  const textContent = stripHtmlTags(sanitizedDescription)
    .replace(/&(?:nbsp|#0*160|#x0*a0);/gi, ' ')
    .trim();
  const imageTags = sanitizedDescription.match(/<img\b[^>]*>/gi) ?? [];
  const hasUsableImage = imageTags.some((imageTag) => {
    const sourceMatch = imageTag.match(
      /\b(?:src|srcset)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i
    );

    return Boolean(
      sourceMatch &&
        [sourceMatch[1], sourceMatch[2], sourceMatch[3]].some((source) =>
          source?.trim()
        )
    );
  });

  return Boolean(textContent) || hasUsableImage;
}

export function OgabasseyPdpDeferredDetailIsland({
  product,
  semanticSections = null,
  serverPrimaryDetails = null,
  storeSlug,
}: OgabasseyPdpDeferredDetailIslandProps) {
  const { description, relatedProduct, tabProduct } =
    buildOgabasseyPdpDeferredProductPayload(product);
  // Sanitize the product description HERE (server) and pass the rendered node
  // into the client tabs island as a slot. This keeps `sanitize-html` (254 KB)
  // and its main-thread parse off the client — the tabs chunk only receives the
  // already-sanitized markup, never the sanitizer. `description` is returned
  // out-of-band (not on `tabProduct`) so the raw HTML is never serialized into
  // the client island props.
  const descriptionSlot = hasRenderableDescriptionContent(description) ? (
    <SafeHtml
      html={description}
      forceLazyImages
      headingLevelOffset={1}
      className="ogabassey-pdp-tabs__rich-text prose max-w-none prose-headings:text-inherit prose-strong:text-inherit prose-table:text-sm"
    />
  ) : null;

  return (
    <section
      aria-label="Product details"
      className="ogabassey-pdp-details-region"
      data-ogabassey-pdp-semantics
    >
      {serverPrimaryDetails}
      {/* Deferred client island #1: tabs / ad / video (rails excluded). */}
      <OgabasseyPdpDeferredDetailClient
        descriptionSlot={descriptionSlot}
        productData={tabProduct}
        storeSlug={storeSlug}
      />
      {/*
        Server-render the semantic SEO sections (compare / price-band / guide
        internal links, trust bullets) in the static HTML, placed BETWEEN the
        tabs island and the rails island. Threading them through a client island
        instead would emit them only in the RSC payload (not crawlable by non-JS
        bots, at-risk for Googlebot). Keeping them SSR'd here keeps them
        crawlable AND lets "Buyer guides" sit above "More <brand> <category>".
      */}
      {semanticSections}
      {/* Deferred client island #2: related-product rails, loaded on scroll. */}
      <OgabasseyPdpDeferredRailsIsland product={relatedProduct} />
    </section>
  );
}
