import {
  type OgabasseyHomeHeroResourceHintIdentity,
  ogabasseyHomeHeroResourceHintProjection,
} from './ogabassey-home-hero-resource-hint-projection';

export interface OgabasseyHomeHeroSlideProjection {
  ctaLabel: string;
  href: string;
  id: string;
  imageAlt: string;
  imageUrl: string;
  kind: 'product';
  name: string;
  priceLabel: string;
}

export type OgabasseyHomeHeroShellInput =
  | {
      merchantId: string;
      slides: readonly OgabasseyHomeHeroSlideProjection[];
      status: 'published';
    }
  | {
      merchantId?: string;
      status: 'unpublished';
    };

export interface OgabasseyHomeHeroProjection {
  candidate: OgabasseyHomeHeroSlideProjection;
  merchantId: string;
  slideCount: number;
  version: 1;
}

export type OgabasseyHomeHeroRequestPublication =
  | { merchantId: string; status: 'published' }
  | { status: 'unbound' | 'unpublished' };

export interface OgabasseyHomeHeroRendererInput {
  preload: OgabasseyHomeHeroResourceHintIdentity | null;
  projection: OgabasseyHomeHeroProjection;
  renderedSlides: readonly OgabasseyHomeHeroSlideProjection[];
  requestPublication: OgabasseyHomeHeroRequestPublication;
}

type OgabasseyHomeHeroRendererAssessment =
  | { valid: true }
  | {
      reason:
        | 'merchant_mismatch'
        | 'publication_mismatch'
        | 'preload_mismatch'
        | 'rendered_candidate_mismatch'
        | 'slide_cardinality_mismatch';
      valid: false;
    };

function getCandidate(
  slides: readonly OgabasseyHomeHeroSlideProjection[]
): OgabasseyHomeHeroSlideProjection | null {
  const slide = slides[0];
  if (!slide?.id || !slide.imageUrl || !slide.href) {
    return null;
  }

  return {
    ctaLabel: slide.ctaLabel,
    href: slide.href,
    id: slide.id,
    imageAlt: slide.imageAlt,
    imageUrl: slide.imageUrl,
    kind: slide.kind,
    name: slide.name,
    priceLabel: slide.priceLabel,
  };
}

function sameCandidate(
  left: OgabasseyHomeHeroSlideProjection,
  right: OgabasseyHomeHeroSlideProjection | undefined
): boolean {
  if (!right) {
    return false;
  }
  return (
    left.ctaLabel === right.ctaLabel &&
    left.href === right.href &&
    left.id === right.id &&
    left.imageAlt === right.imageAlt &&
    left.imageUrl === right.imageUrl &&
    left.kind === right.kind &&
    left.name === right.name &&
    left.priceLabel === right.priceLabel
  );
}

/**
 * Pure H1A preparation contract for the current homepage seam. It deliberately
 * has no route, cache, or rendering side effects; later H1 phases can adopt
 * this single candidate/preload/renderer identity without changing it.
 */
export const ogabasseyHomeHeroContract = {
  assessRenderer(
    input: OgabasseyHomeHeroRendererInput
  ): OgabasseyHomeHeroRendererAssessment {
    if (input.requestPublication.status !== 'published') {
      return { reason: 'publication_mismatch', valid: false };
    }
    if (input.projection.merchantId !== input.requestPublication.merchantId) {
      return { reason: 'merchant_mismatch', valid: false };
    }
    const expectedPreload = ogabasseyHomeHeroResourceHintProjection.build(
      input.projection.candidate.imageUrl
    );
    if (
      expectedPreload?.digest !== input.preload?.digest ||
      (input.preload !== null &&
        !ogabasseyHomeHeroResourceHintProjection.validate(input.preload))
    ) {
      return { reason: 'preload_mismatch', valid: false };
    }
    if (input.projection.slideCount !== input.renderedSlides.length) {
      return { reason: 'slide_cardinality_mismatch', valid: false };
    }
    if (!sameCandidate(input.projection.candidate, input.renderedSlides[0])) {
      return { reason: 'rendered_candidate_mismatch', valid: false };
    }
    return { valid: true };
  },

  preloadIdentity(
    projection: OgabasseyHomeHeroProjection
  ): OgabasseyHomeHeroResourceHintIdentity | null {
    return ogabasseyHomeHeroResourceHintProjection.build(
      projection.candidate.imageUrl
    );
  },

  project(
    shell: OgabasseyHomeHeroShellInput
  ): OgabasseyHomeHeroProjection | null {
    if (shell.status !== 'published' || !shell.merchantId) {
      return null;
    }
    const candidate = getCandidate(shell.slides);
    if (!candidate) {
      return null;
    }
    return {
      candidate,
      merchantId: shell.merchantId,
      slideCount: shell.slides.length,
      version: 1,
    };
  },
} as const;
