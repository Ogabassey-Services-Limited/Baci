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
    expect(screen.getByRole('radio', { name: /door delivery/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /pickup/i })).toBeInTheDocument();
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

  it('renders airport for eligible non-Lagos states and hides pickup', () => {
    render(
      <DeliveryMethodSelector
        {...defaultProps}
        newAddressState="Abuja"
        newAddressCity="Garki"
      />,
    );

    expect(screen.getByRole('radio', { name: /airport/i })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /pickup/i })).not.toBeInTheDocument();
  });

  it('calls setDeliveryMethod when a delivery option is selected', () => {
    render(<DeliveryMethodSelector {...defaultProps} />);

    fireEvent.click(screen.getByRole('radio', { name: /pickup/i }));

    expect(defaultProps.setDeliveryMethod).toHaveBeenCalledWith('pickup');
  });
});
