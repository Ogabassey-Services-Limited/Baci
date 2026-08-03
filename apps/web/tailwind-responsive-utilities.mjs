export default function registerResponsiveUtilities({
  addUtilities,
  addComponents,
}) {
  addUtilities({
    '.safe-top': {
      'padding-top': 'env(safe-area-inset-top)',
    },
    '.safe-bottom': {
      'padding-bottom': 'env(safe-area-inset-bottom)',
    },
    '.safe-left': {
      'padding-left': 'env(safe-area-inset-left)',
    },
    '.safe-right': {
      'padding-right': 'env(safe-area-inset-right)',
    },
    '.safe-x': {
      'padding-left': 'env(safe-area-inset-left)',
      'padding-right': 'env(safe-area-inset-right)',
    },
    '.safe-y': {
      'padding-top': 'env(safe-area-inset-top)',
      'padding-bottom': 'env(safe-area-inset-bottom)',
    },
    '.safe-all': {
      'padding-top': 'env(safe-area-inset-top)',
      'padding-right': 'env(safe-area-inset-right)',
      'padding-bottom': 'env(safe-area-inset-bottom)',
      'padding-left': 'env(safe-area-inset-left)',
    },
    '.m-safe-top': {
      'margin-top': 'env(safe-area-inset-top)',
    },
    '.m-safe-bottom': {
      'margin-bottom': 'env(safe-area-inset-bottom)',
    },
    '.p-inline-4': {
      'padding-inline': '1rem',
    },
    '.p-inline-6': {
      'padding-inline': '1.5rem',
    },
    '.p-inline-8': {
      'padding-inline': '2rem',
    },
    '.p-block-4': {
      'padding-block': '1rem',
    },
    '.p-block-6': {
      'padding-block': '1.5rem',
    },
    '.p-block-8': {
      'padding-block': '2rem',
    },
    '.m-inline-auto': {
      'margin-inline': 'auto',
    },
    '.m-inline-4': {
      'margin-inline': '1rem',
    },
    '.m-block-4': {
      'margin-block': '1rem',
    },
    '.m-block-8': {
      'margin-block': '2rem',
    },
    '.snap-x-mandatory': {
      'scroll-snap-type': 'x mandatory',
    },
    '.snap-y-mandatory': {
      'scroll-snap-type': 'y mandatory',
    },
    '.snap-x-proximity': {
      'scroll-snap-type': 'x proximity',
    },
    '.snap-center': {
      'scroll-snap-align': 'center',
    },
    '.snap-start': {
      'scroll-snap-align': 'start',
    },
    '.snap-end': {
      'scroll-snap-align': 'end',
    },
    '.contain-layout': {
      contain: 'layout',
    },
    '.contain-paint': {
      contain: 'paint',
    },
    '.contain-strict': {
      contain: 'strict',
    },
    '.contain-content': {
      contain: 'content',
    },
    '.content-auto': {
      'content-visibility': 'auto',
    },
    '.content-hidden': {
      'content-visibility': 'hidden',
    },
    '.touch-pan-x': {
      'touch-action': 'pan-x',
    },
    '.touch-pan-y': {
      'touch-action': 'pan-y',
    },
    '.touch-pinch-zoom': {
      'touch-action': 'pinch-zoom',
    },
    '.touch-manipulation': {
      'touch-action': 'manipulation',
    },
  });

  addComponents({
    '.touch-target': {
      'min-width': '44px',
      'min-height': '44px',
      display: 'inline-flex',
      'align-items': 'center',
      'justify-content': 'center',
    },
    '.touch-target-lg': {
      'min-width': '48px',
      'min-height': '48px',
      display: 'inline-flex',
      'align-items': 'center',
      'justify-content': 'center',
    },
  });
}
