import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RepairsRecyclingSection } from './repairs-recycling-section';

describe('RepairsRecyclingSection', () => {
  it('renders the recycling heading and disposal callouts', () => {
    render(<RepairsRecyclingSection />);

    expect(
      screen.getByRole('heading', { name: /recycle responsibly/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Safe Disposal')).toBeInTheDocument();
    expect(screen.getByText('Glass Recycling')).toBeInTheDocument();
    expect(screen.getByText('Component Harvest')).toBeInTheDocument();
  });
});
