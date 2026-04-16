import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductMigrationBadges } from './product-migration-badges';

describe('ProductMigrationBadges', () => {
  it('renders nothing for legacy products without migration flags', () => {
    const { container } = render(
      <ProductMigrationBadges migrationStatus="pending" variantModel="legacy" />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders sku_matrix and needs_review badges together', () => {
    render(
      <ProductMigrationBadges
        migrationStatus="needs_review"
        variantModel="sku_matrix"
      />
    );

    expect(screen.getByText('SKU Matrix')).toBeInTheDocument();
    expect(screen.getByText('Needs Review')).toBeInTheDocument();
  });

  it('renders migrated badge for migrated sku_matrix products', () => {
    render(
      <ProductMigrationBadges
        migrationStatus="migrated"
        variantModel="sku_matrix"
      />
    );

    expect(screen.getByText('Migrated')).toBeInTheDocument();
  });
});
