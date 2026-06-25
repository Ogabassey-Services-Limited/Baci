import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TrackOrderLayout, { metadata } from './layout';

describe('TrackOrderLayout', () => {
  it('marks order-tracking lookups as non-indexable', () => {
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it('renders children without adding a page-owned loading fallback', () => {
    render(
      <TrackOrderLayout>
        <div>Track order form</div>
      </TrackOrderLayout>
    );

    expect(screen.getByText('Track order form')).toBeInTheDocument();
    expect(screen.queryByText(/loading/i)).toBeNull();
  });
});
