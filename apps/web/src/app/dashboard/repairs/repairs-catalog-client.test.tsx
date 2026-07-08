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
    render(<RepairsCatalogClient />);
    expect(screen.getByRole('tab', { name: 'Bookings' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Catalog' })).toBeInTheDocument();
    expect(screen.getByText('bookings-manager')).toBeInTheDocument();
  });
});
