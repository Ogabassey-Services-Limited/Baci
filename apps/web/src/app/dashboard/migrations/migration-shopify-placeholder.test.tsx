import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MigrationShopifyPlaceholder from '@/app/dashboard/migrations/migration-shopify-placeholder';

describe('MigrationShopifyPlaceholder', () => {
  it('renders the Shopify migration placeholder sections', () => {
    render(<MigrationShopifyPlaceholder />);

    expect(screen.getByText(/shopify migration/i)).toBeInTheDocument();
    expect(
      screen.getByText(/shopify connection is the next migration path/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Connect store')).toBeInTheDocument();
    expect(screen.getByText('Pull and preview')).toBeInTheDocument();
    expect(screen.getByText('Merchant-safe launch')).toBeInTheDocument();
  });
});
