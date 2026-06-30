import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlogCategoryGuide } from './blog-category-guide';

describe('BlogCategoryGuide', () => {
  it('renders Ogabassey-specific crawlable guidance for known electronics categories', () => {
    render(
      <BlogCategoryGuide
        category="Smartphone Comparisons"
        isOgabasseyBlogTenant
        merchantName="Ogabassey"
        totalPosts={12}
      />
    );

    expect(
      screen.getByRole('heading', {
        name: 'How to use Ogabassey smartphone comparison articles',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Compare exact RAM and storage variants before choosing/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/whether the exact variant is available in Nigeria/)
    ).toBeInTheDocument();
  });

  it.each([
    ['  Smartphone Comparisons  '],
    ['Smartphone Comparisons!!!'],
    ['Smartphone Comparisons &'],
  ])('normalizes mapped Ogabassey category labels like %s', (categoryLabel) => {
    render(
      <BlogCategoryGuide
        category={categoryLabel}
        isOgabasseyBlogTenant
        merchantName="Renamed Storefront"
        totalPosts={12}
      />
    );

    expect(
      screen.getByRole('heading', {
        name: 'How to use Ogabassey smartphone comparison articles',
      })
    ).toBeInTheDocument();
  });

  it('uses generic merchant-safe copy for non-Ogabassey categories', () => {
    render(
      <BlogCategoryGuide
        category="News"
        merchantName="Aisha Fashion"
        totalPosts={1}
      />
    );

    expect(
      screen.getByRole('heading', {
        name: 'About News articles from Aisha Fashion',
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/There is 1 article/)).toBeInTheDocument();
    expect(
      screen.queryByText(/electronics buyers in Nigeria/)
    ).not.toBeInTheDocument();
  });

  it('falls back to generic copy for unmapped Ogabassey categories', () => {
    render(
      <BlogCategoryGuide
        category="Accessories"
        isOgabasseyBlogTenant
        merchantName="Ogabassey"
        totalPosts={2}
      />
    );

    expect(
      screen.getByRole('heading', {
        name: 'About Accessories articles from Ogabassey',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/There are 2 articles in this archive/)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/How to use Ogabassey deals articles/)
    ).not.toBeInTheDocument();
  });
});
