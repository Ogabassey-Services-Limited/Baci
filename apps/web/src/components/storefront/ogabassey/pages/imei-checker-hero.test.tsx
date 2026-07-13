import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ImeiCheckerHero } from './imei-checker-hero';

describe('ImeiCheckerHero', () => {
  it('renders the trust pill, headline, and trust row copy', () => {
    render(<ImeiCheckerHero />);

    expect(screen.getByText('Trusted by 10,000+ Buyers')).toBeTruthy();
    expect(screen.getByText("Don't Get Scammed.")).toBeTruthy();
    expect(screen.getByText('Verify First.')).toBeTruthy();
    expect(screen.getByText('Instant Results')).toBeTruthy();
    expect(screen.getByText('Official Database')).toBeTruthy();
    expect(screen.getByText('100% Accurate')).toBeTruthy();
  });
});
