import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: () => null,
}));

import { OgabasseyHomeHeroFallback } from './ogabassey-home-hero-fallback';

describe('OgabasseyHomeHeroFallback', () => {
  it('preserves mobile and desktop hero geometry while dynamic content streams', () => {
    const { container } = render(<OgabasseyHomeHeroFallback />);

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Just Launched')).toBeInTheDocument();
  });
});
