import { describe, expect, it, vi } from 'vitest';
import registerResponsiveUtilities from './tailwind-responsive-utilities.mjs';

describe('responsive Tailwind utilities', () => {
  it('registers the safe-area and touch-target utility contracts', () => {
    const addUtilities = vi.fn();
    const addComponents = vi.fn();

    registerResponsiveUtilities({ addComponents, addUtilities });

    expect(addUtilities).toHaveBeenCalledWith(
      expect.objectContaining({
        '.safe-all': {
          'padding-bottom': 'env(safe-area-inset-bottom)',
          'padding-left': 'env(safe-area-inset-left)',
          'padding-right': 'env(safe-area-inset-right)',
          'padding-top': 'env(safe-area-inset-top)',
        },
        '.touch-manipulation': {
          'touch-action': 'manipulation',
        },
      })
    );
    expect(addComponents).toHaveBeenCalledWith({
      '.touch-target': {
        'align-items': 'center',
        'justify-content': 'center',
        'min-height': '44px',
        'min-width': '44px',
        display: 'inline-flex',
      },
      '.touch-target-lg': {
        'align-items': 'center',
        'justify-content': 'center',
        'min-height': '48px',
        'min-width': '48px',
        display: 'inline-flex',
      },
    });
  });
});
