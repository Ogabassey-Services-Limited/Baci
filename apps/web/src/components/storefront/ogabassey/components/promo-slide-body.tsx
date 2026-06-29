import type { LaunchPromoSlide } from './LaunchCarousel';

/** CSS-only, theme-driven body for a promotional slide (no image). */
export function PromoSlideBody({ slide }: { slide: LaunchPromoSlide }) {
  return (
    <div className="flex h-full flex-col justify-center gap-1 bg-store-primary px-6 text-store-on-primary md:px-10">
      <h3 className="line-clamp-2 text-xl font-bold leading-tight md:text-3xl">
        {slide.title}
      </h3>
      {slide.subtitle ? (
        <p className="line-clamp-2 max-w-md text-sm opacity-90 md:text-lg">
          {slide.subtitle}
        </p>
      ) : null}
      {slide.ctaLabel ? (
        <span className="mt-3 inline-flex w-fit items-center rounded-full bg-store-on-primary px-5 py-2 text-xs font-bold text-store-primary shadow-sm transition-transform active:scale-95 md:text-sm">
          {slide.ctaLabel}
        </span>
      ) : null}
    </div>
  );
}
