import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./devices-manager', () => ({ default: () => <div>devices</div> }));
vi.mock('./service-types-manager', () => ({
  default: () => <div>service-types</div>,
}));
vi.mock('./import-manager', () => ({ default: () => <div>import</div> }));

import CatalogManager from './catalog-manager';

describe('CatalogManager', () => {
  it('renders the catalogue sub-tabs', () => {
    render(<CatalogManager />);
    expect(screen.getByRole('tab', { name: 'Devices' })).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'Service types' })
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'AI import' })).toBeInTheDocument();
  });
});
