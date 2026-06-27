import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CategoryPageCrawlSummary } from './category-page-crawl-summary';

describe('CategoryPageCrawlSummary', () => {
  it('renders category-specific buyer context with product examples', () => {
    render(
      <CategoryPageCrawlSummary
        categoryName="Children's Tablets"
        merchantName="Ogabassey"
        productNames={['Kids Tablet Pro', 'Learning Pad', 'Study Tab']}
      />
    );

    expect(
      screen.getByRole('heading', {
        name: "Buying Children's Tablets on Ogabassey",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/compare the product name, brand, price/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Kids Tablet Pro, Learning Pad/i)
    ).toBeInTheDocument();
  });

  it('uses a generic comparison prompt when there are no product examples', () => {
    render(
      <CategoryPageCrawlSummary
        categoryName="Accessories"
        merchantName="Ogabassey"
      />
    );

    expect(
      screen.getByText(/Use the live product grid to compare available models/i)
    ).toBeInTheDocument();
  });
});
