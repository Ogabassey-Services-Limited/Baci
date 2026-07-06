/**
 * Shared geometry classes for the mobile hero's first frame.
 *
 * Consumed by BOTH the interactive carousel (`hero-mobile-carousel.tsx`) and
 * the static PPR-shell fallback (`ogabassey-home-hero-fallback.tsx`). The
 * fallback must be pixel-identical to the carousel's slide-0 frame so the
 * Suspense swap is visually a no-op — home's field CLS (0.37) came from the
 * generic baked banner being replaced by a differently-shaped product hero.
 * Keeping the classes in one module makes that parity structural: a styling
 * change either moves both surfaces together or fails the parity test.
 */

export const HERO_MOBILE_WRAPPER_CLASSES = 'md:hidden mb-4 order-1';

export const HERO_MOBILE_PANEL_CLASSES =
  'relative h-48 touch-pan-y overflow-hidden rounded-2xl bg-store-secondary shadow-2xl ring-1 ring-store-border/70';

export const HERO_MOBILE_SLIDE_GRID_CLASSES = 'absolute inset-0 grid grid-cols-5';

export const HERO_MOBILE_TEXT_COLUMN_CLASSES =
  'col-span-3 flex flex-col justify-center gap-1 px-5 py-4';

export const HERO_MOBILE_EYEBROW_CLASSES =
  'text-[9px] font-semibold uppercase tracking-[0.12em] text-store-primary';

export const HERO_MOBILE_TITLE_CLASSES =
  'line-clamp-2 text-[1.2rem] font-extrabold leading-tight text-store-secondary-text';

export const HERO_MOBILE_PRICE_CLASSES =
  'text-[11px] font-semibold text-store-secondary-text';

export const HERO_MOBILE_CTA_CLASSES =
  'mt-2 inline-flex w-fit items-center rounded-full bg-store-primary px-4 py-1.5 text-[11px] font-bold text-store-on-primary shadow-sm';

export const HERO_MOBILE_IMAGE_COLUMN_CLASSES = 'relative col-span-2';

/** Controls row shown when the carousel has more than one slide — the real
 * hero is ~52px taller with it, so the fallback must reserve it too. */
export const HERO_MOBILE_CONTROLS_ROW_CLASSES =
  'mt-2 flex items-center gap-2 px-1';

export const HERO_MOBILE_CONTROL_TRACK_CLASSES = 'h-11 flex-1';

/** Geometry only — the call sites add their own fill (`bg-store-primary`). */
export const HERO_MOBILE_PLAY_TOGGLE_SLOT_CLASSES =
  'h-11 min-w-11 rounded-full';
