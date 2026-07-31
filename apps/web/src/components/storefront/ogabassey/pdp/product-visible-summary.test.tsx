import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OgabasseyPdpProductVisibleSummary } from './product-visible-summary';

describe('OgabasseyPdpProductVisibleSummary', () => {
  it('renders the precomputed summary as visible plain text', () => {
    render(
      <OgabasseyPdpProductVisibleSummary
        summary="Samsung Galaxy S24. Available choices: Storage 128 GB or 256 GB."
      />
    );

    const summary = screen.getByText(
      'Samsung Galaxy S24. Available choices: Storage 128 GB or 256 GB.'
    );

    expect(summary).toBeVisible();
    expect(summary).toHaveAttribute('data-ogabassey-pdp-visible-summary');
    expect(summary.querySelector('*')).toBeNull();
  });

  it('renders nothing when there is no safe precomputed summary', () => {
    const { container } = render(
      <OgabasseyPdpProductVisibleSummary summary={null} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
