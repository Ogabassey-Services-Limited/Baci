import type React from 'react';
import { useId } from 'react';

/** Default stroke color for the built-in gadget tile (phones/chips/batteries). */
const DEFAULT_STROKE = '#ffffff';

/**
 * GadgetPattern
 *
 * A subtle background pattern featuring tech/gadget shapes (phones, chips,
 * batteries). Used for premium Ogabassey branding (Login, Header, Footer),
 * and — via the `stroke`/`children` overrides below — for the mobile footer
 * and secondary-nav decorative bands, which reuse this same mechanism with
 * their own tile shapes and stroke color.
 *
 * Rendered as an INLINE `<svg>` (vector shapes tiled via `<pattern>`) instead
 * of a `div` with `background-image: url(data:svg)`. This is deliberate and
 * load-bearing for LCP: `url()` background images ARE Largest Contentful
 * Paint candidates, and field data (PostHog `debugTarget`, 2026-07-10) showed
 * this decorative pattern was crowned the homepage LCP element in ~64% of
 * real sessions — painting late with the streamed navbar chrome and dragging
 * home LCP p75 to ~5s. Inline SVG shape content is NOT an LCP candidate
 * (candidates: <img>, <image> in svg, video poster, url() backgrounds, text),
 * so the real hero image becomes the LCP instead. Do not convert this back to
 * a CSS background image — this includes any hand-rolled callers; route new
 * decorative-pattern needs through this component instead of a fresh
 * `background-image: url(data:svg)` div.
 *
 * The tile is drawn in a 150-unit viewBox and scaled to the original 140px
 * `backgroundSize` via the pattern transform — pixel-identical to the old
 * rendering. Pass `children` to swap in a different set of `<g>`/shape
 * elements (e.g. a sparser or denser tile) while keeping the same wrapper,
 * scaling, and LCP-safe mechanism; pass `stroke` to recolor it.
 */
export const GadgetPattern: React.FC<{
  children?: React.ReactNode;
  className?: string;
  opacity?: number;
  stroke?: string;
}> = ({ children, className = '', opacity = 0.05, stroke = DEFAULT_STROKE }) => {
  // Several instances render per page (navbar, hero band, footer) — pattern
  // ids must not collide or every instance paints the first one's tile.
  const patternId = useId();

  return (
    <svg
      aria-hidden="true"
      className={className}
      data-testid="ogabassey-gadget-pattern"
      height="100%"
      role="presentation"
      style={{
        inset: 0,
        opacity,
        pointerEvents: 'none',
        position: 'absolute',
      }}
      width="100%"
    >
      <defs>
        <pattern
          height="140"
          id={patternId}
          patternUnits="userSpaceOnUse"
          width="140"
        >
          {/* 150-unit tile scaled to the 140px background-size of the old CSS. */}
          <g
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
            transform="scale(0.93333)"
          >
            {children ?? (
              <>
                <g transform="translate(20, 20) rotate(-15 6 10)">
                  <rect height="20" rx="2" width="12" x="0" y="0" />
                  <circle cx="6" cy="16" r="1" />
                </g>
                <path d="M40 10 l5 5 l-5 5" opacity="0.6" strokeWidth="1" />

                <g transform="translate(120, 15) rotate(10 9 6)">
                  <rect height="12" rx="2" width="18" x="0" y="0" />
                  <line opacity="0.5" x1="4" x2="14" y1="6" y2="6" />
                </g>
                <circle
                  cx="100"
                  cy="30"
                  fill="#ffffff"
                  opacity="0.6"
                  r="1.5"
                />

                <g transform="translate(15, 70) rotate(45)">
                  <rect height="10" rx="1" width="10" x="0" y="0" />
                </g>
                <path
                  d="M35 80 l10 0 m-5 -5 l0 10"
                  opacity="0.7"
                  strokeWidth="1"
                />

                <g transform="translate(120, 90) rotate(5 9 6)">
                  <rect height="12" rx="2" width="18" x="0" y="3" />
                  <circle cx="14" cy="9" r="2" />
                  <rect
                    fill="#ffffff"
                    height="8"
                    opacity="0.4"
                    width="2"
                    x="2"
                    y="5"
                  />
                </g>

                <g transform="translate(30, 120) rotate(-25 10 6)">
                  <circle cx="6" cy="6" r="2" />
                  <path
                    d="M0 6 l-4 0 m16 0 l4 0 m-8 -8 l0 -4 m0 16 l0 4"
                    strokeWidth="1"
                  />
                </g>

                <g transform="translate(90, 125) rotate(15)">
                  <rect height="14" rx="1.5" width="8" x="0" y="0" />
                </g>
                <circle cx="140" cy="70" fill="#ffffff" r="2" stroke="none" />
                <path d="M80 50 l3 3 m-3 0 l3 -3" strokeWidth="1" />
                <circle cx="60" cy="100" fill="#ffffff" opacity="0.5" r="1" />
              </>
            )}
          </g>
        </pattern>
      </defs>
      <rect fill={`url(#${patternId})`} height="100%" width="100%" />
    </svg>
  );
};
