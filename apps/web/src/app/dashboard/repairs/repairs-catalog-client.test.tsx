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

  it('does not show the "not live" notice when the catalogue is public', () => {
    render(<RepairsCatalogClient canEdit canDelete catalogPubliclyEnabled />);

    expect(
      screen.queryByText(/isn't live on your storefront yet/i)
    ).not.toBeInTheDocument();
  });

  it('keeps the Catalog tab reachable before publish and shows a not-live notice', () => {
    render(
      <RepairsCatalogClient canEdit canDelete catalogPubliclyEnabled={false} />
    );

    // The catalogue manager must stay reachable so merchants can build/import
    // their catalogue BEFORE flipping the public flag (Codex P2 regression).
    expect(screen.getByRole('tab', { name: 'Catalog' })).toBeInTheDocument();
    expect(
      screen.getByText(/isn't live on your storefront yet/i)
    ).toBeInTheDocument();
  });
});
