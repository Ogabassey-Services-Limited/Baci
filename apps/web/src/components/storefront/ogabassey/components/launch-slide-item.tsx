import Link from 'next/link';
import { asRoute } from '@/lib/routes';
import type { LaunchSlide } from './LaunchCarousel';
import { ProductSlideBody } from './product-slide-body';
import { PromoSlideBody } from './promo-slide-body';

interface LaunchSlideItemProps {
  slide: LaunchSlide;
  index: number;
  isCurrent: boolean;
  /** Eager/high-priority this slide's image (the LCP candidate). */
  prioritizeImage: boolean;
}

/** One carousel slide: the kind-specific body plus a full-bleed PDP link
 *  (product/promo slides only). Inactive slides are `inert` + `aria-hidden`. */
export function LaunchSlideItem({
  slide,
  index,
  isCurrent,
  prioritizeImage,
}: LaunchSlideItemProps) {
  const slideTitle =
    slide.kind === 'product'
      ? slide.name
      : slide.kind === 'promo'
        ? slide.title
        : 'Advertisement';
  const label =
    slide.kind === 'product'
      ? `${slide.name} — ${slide.ctaLabel}`
      : slide.kind === 'promo'
        ? (slide.ctaLabel ?? slide.title)
        : 'Advertisement';
  const href = 'href' in slide ? slide.href : undefined;

  return (
    <div
      aria-hidden={!isCurrent}
      aria-label={`Slide ${index + 1}: ${slideTitle}`}
      aria-roledescription="slide"
      className="relative h-full w-full shrink-0"
      inert={!isCurrent}
      role="group"
    >
      {slide.kind === 'product' ? (
        <ProductSlideBody priority={prioritizeImage} slide={slide} />
      ) : slide.kind === 'promo' ? (
        <PromoSlideBody slide={slide} />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-store-background py-3">
          {/* No horizontal padding / overflow clip so a full-width (e.g. 320px)
              ad creative isn't cut off on small phones. */}
          {slide.content}
        </div>
      )}
      {href ? (
        <Link
          aria-label={label}
          className="absolute inset-0"
          href={asRoute(href)}
          prefetch={false}
        >
          <span className="sr-only">{label}</span>
        </Link>
      ) : null}
    </div>
  );
}
