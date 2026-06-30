import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GadgetPattern } from './GadgetPattern';

describe('GadgetPattern', () => {
  it('renders the encoded gadget SVG pattern as a non-interactive background', () => {
    render(<GadgetPattern />);

    const pattern = screen.getByTestId('ogabassey-gadget-pattern');

    expect(pattern).toHaveAttribute('aria-hidden', 'true');
    expect(pattern).toHaveStyle({
      backgroundSize: '140px 140px',
      inset: '0',
      opacity: '0.05',
      pointerEvents: 'none',
      position: 'absolute',
    });
    expect(pattern?.getAttribute('style')).toContain('data:image/svg+xml');
  });

  it('allows the pattern opacity and class name to be customized', () => {
    render(<GadgetPattern className="absolute inset-0" opacity={0.1} />);

    const pattern = screen.getByTestId('ogabassey-gadget-pattern');

    expect(pattern).toHaveClass('absolute', 'inset-0');
    expect(pattern).toHaveStyle({ opacity: '0.1' });
  });
});
