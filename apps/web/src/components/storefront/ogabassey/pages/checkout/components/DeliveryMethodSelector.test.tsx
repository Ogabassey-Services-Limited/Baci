import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeliveryMethodSelector } from './DeliveryMethodSelector';

describe('DeliveryMethodSelector', () => {
  const defaultProps: ComponentProps<typeof DeliveryMethodSelector> = {
    isHydrated: true,
    newAddressState: 'Lagos',
    newAddressCity: 'Ikeja',
    isNewAddressMode: true,
    selectedAddressId: 0,
    deliveryMethod: 'door',
    setDeliveryMethod: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders delivery methods when a location is available', () => {
    render(<DeliveryMethodSelector {...defaultProps} />);

    expect(
      screen.getByRole('group', {
        name: /how would you like to receive your order/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /by road/i })).toBeChecked();
    expect(
      screen.getByRole('radio', { name: /store pickup/i }),
    ).toBeInTheDocument();
  });

  it('does not render before a usable location is available', () => {
    render(
      <DeliveryMethodSelector
        {...defaultProps}
        isHydrated={false}
        newAddressState=""
        newAddressCity=""
      />,
    );

    expect(
      screen.queryByRole('group', {
        name: /how would you like to receive your order/i,
      }),
    ).not.toBeInTheDocument();
  });

  it('renders air and provider pickup for eligible non-Lagos states', () => {
    render(
      <DeliveryMethodSelector
        {...defaultProps}
        newAddressState="Abuja"
        newAddressCity="Garki"
      />,
    );

    expect(screen.getByRole('radio', { name: /by air/i })).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: /pickup station/i }),
    ).toBeInTheDocument();
  });

  it('renders GIGL pickup stations before a station quote is available', () => {
    render(
      <DeliveryMethodSelector
        {...defaultProps}
        newAddressState="Rivers"
        newAddressCity="Port Harcourt"
      />,
    );

    expect(
      screen.getByRole('radio', { name: /pickup station/i }),
    ).toBeInTheDocument();
  });

  it('keeps Lagos merchant pickup instead of showing paid GIGL pickup', () => {
    render(
      <DeliveryMethodSelector {...defaultProps} />,
    );

    expect(screen.getAllByRole('radio', { name: /store pickup/i })).toHaveLength(
      1,
    );
  });

  it('calls setDeliveryMethod when a delivery option is selected', () => {
    render(<DeliveryMethodSelector {...defaultProps} />);

    fireEvent.click(screen.getByRole('radio', { name: /store pickup/i }));

    expect(defaultProps.setDeliveryMethod).toHaveBeenCalledWith('pickup');
  });
});
