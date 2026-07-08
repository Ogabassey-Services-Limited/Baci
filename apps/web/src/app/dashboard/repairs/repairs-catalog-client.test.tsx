import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./catalog-manager', () => ({
  default: () => <div>catalog-manager</div>,
}));
vi.mock('./bookings-placeholder', () => ({
  default: () => <div>bookings-placeholder</div>,
}));

import RepairsCatalogClient from './repairs-catalog-client';

describe('RepairsCatalogClient', () => {
  it('renders the Catalog and Bookings tabs with Catalog active', () => {
    render(<RepairsCatalogClient />);
    expect(screen.getByRole('tab', { name: 'Catalog' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Bookings' })).toBeInTheDocument();
    expect(screen.getByText('catalog-manager')).toBeInTheDocument();
  });
});
