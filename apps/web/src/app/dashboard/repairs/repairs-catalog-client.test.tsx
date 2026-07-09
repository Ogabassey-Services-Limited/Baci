import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./catalog-manager', () => ({
  default: () => <div>catalog-manager</div>,
}));
vi.mock('./bookings-manager', () => ({
  default: () => <div>bookings-manager</div>,
}));

import RepairsCatalogClient from './repairs-catalog-client';

describe('RepairsCatalogClient', () => {
  it('renders the Bookings and Catalog tabs with Bookings active', () => {
    render(<RepairsCatalogClient canEdit canDelete />);
    expect(screen.getByRole('tab', { name: 'Bookings' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Catalog' })).toBeInTheDocument();
    expect(screen.getByText('bookings-manager')).toBeInTheDocument();
  });

  it('keeps bookings available when catalogue management is disabled', () => {
    render(<RepairsCatalogClient canEdit canDelete catalogEnabled={false} />);

    expect(screen.getByRole('tab', { name: 'Bookings' })).toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: 'Catalog' })
    ).not.toBeInTheDocument();
    expect(screen.getByText('bookings-manager')).toBeInTheDocument();
  });
});
