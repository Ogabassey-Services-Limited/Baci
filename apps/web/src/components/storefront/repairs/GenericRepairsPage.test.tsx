import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GenericRepairsPage } from './GenericRepairsPage';

const mockRepairDevicePicker = vi.fn();

vi.mock('./RepairDevicePicker', () => ({
  RepairDevicePicker: (props: Record<string, unknown>) => {
    mockRepairDevicePicker(props);
    return <div data-testid="device-picker" />;
  },
}));

const groups = [
  {
    brand: 'Apple',
    devices: [
      {
        id: 'd1',
        brand: 'Apple',
        model: 'iPhone 13',
        slug: 'apple-iphone-13',
        deviceType: 'Smartphone' as const,
        imageUrl: null,
        productId: null,
      },
    ],
  },
];

describe('GenericRepairsPage', () => {
  it('renders a heading mentioning the merchant and the device picker', () => {
    render(
      <GenericRepairsPage
        basePath="/acme-gadgets"
        groups={groups}
        merchantName="Acme Gadgets"
      />
    );

    expect(
      screen.getByRole('heading', { name: /device repairs/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/acme gadgets/i)).toBeInTheDocument();
    expect(screen.getByTestId('device-picker')).toBeInTheDocument();
    expect(mockRepairDevicePicker).toHaveBeenCalledWith(
      expect.objectContaining({
        basePath: '/acme-gadgets',
        groups,
        notListedHref: '/acme-gadgets/repair',
      })
    );
  });

  it('resolves the not-listed link at the domain root when basePath is empty', () => {
    render(
      <GenericRepairsPage basePath="" groups={groups} merchantName="Acme" />
    );

    expect(mockRepairDevicePicker).toHaveBeenCalledWith(
      expect.objectContaining({ notListedHref: '/repair' })
    );
  });
});
