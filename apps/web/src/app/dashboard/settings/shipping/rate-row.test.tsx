import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { formatAmountInCurrency } from '@/lib/resolve-merchant-currency';
import { RateRow } from './rate-row';
import type { ShippingRate } from './shipping-types';

function makeRate(overrides: Partial<ShippingRate> = {}): ShippingRate {
  return {
    id: 'r-1',
    zoneId: 'z-1',
    name: 'Standard',
    kind: 'ship',
    currency: 'NGN',
    baseAmount: 1500,
    conditionType: 'always',
    minSubtotal: null,
    maxSubtotal: null,
    freeOverAmount: null,
    deliveryMinDays: null,
    deliveryMaxDays: null,
    pickupAddress: null,
    sortOrder: 0,
    active: true,
    ...overrides,
  };
}

describe('RateRow', () => {
  it('renders the rate name, active badge, and formatted price', () => {
    const rate = makeRate();
    const { container } = render(
      <RateRow
        rate={rate}
        onEdit={vi.fn()}
        onDeleteRequested={vi.fn()}
        onToggleActive={vi.fn()}
        isToggling={false}
      />
    );

    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(container.textContent).toContain(
      formatAmountInCurrency(1500, 'NGN')
    );
    expect(container.textContent).toContain('Always applies');
  });

  it('shows an Inactive badge and a Pickup badge for an inactive pickup rate', () => {
    const rate = makeRate({ kind: 'pickup', active: false });
    render(
      <RateRow
        rate={rate}
        onEdit={vi.fn()}
        onDeleteRequested={vi.fn()}
        onToggleActive={vi.fn()}
        isToggling={false}
      />
    );

    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('Pickup')).toBeInTheDocument();
  });

  it('shows the free-over threshold and delivery estimate when set', () => {
    const rate = makeRate({
      freeOverAmount: 50_000,
      deliveryMinDays: 2,
      deliveryMaxDays: 4,
    });
    const { container } = render(
      <RateRow
        rate={rate}
        onEdit={vi.fn()}
        onDeleteRequested={vi.fn()}
        onToggleActive={vi.fn()}
        isToggling={false}
      />
    );

    expect(container.textContent).toContain(
      `Free over ${formatAmountInCurrency(50_000, 'NGN')}`
    );
    expect(screen.getByText('2–4 days')).toBeInTheDocument();
  });

  it('omits the delivery estimate line when neither bound is set', () => {
    const rate = makeRate();
    render(
      <RateRow
        rate={rate}
        onEdit={vi.fn()}
        onDeleteRequested={vi.fn()}
        onToggleActive={vi.fn()}
        isToggling={false}
      />
    );

    expect(screen.queryByText(/days$/)).not.toBeInTheDocument();
  });

  it('calls onEdit and onDeleteRequested when their buttons are clicked', async () => {
    const user = userEvent.setup();
    const handleEdit = vi.fn();
    const handleDelete = vi.fn();
    const rate = makeRate();
    render(
      <RateRow
        rate={rate}
        onEdit={handleEdit}
        onDeleteRequested={handleDelete}
        onToggleActive={vi.fn()}
        isToggling={false}
      />
    );

    await user.click(screen.getByRole('button', { name: /edit standard/i }));
    expect(handleEdit).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: /delete standard/i }));
    expect(handleDelete).toHaveBeenCalledOnce();
  });

  it('toggles active state via the switch', () => {
    const handleToggle = vi.fn();
    const rate = makeRate({ active: true });
    render(
      <RateRow
        rate={rate}
        onEdit={vi.fn()}
        onDeleteRequested={vi.fn()}
        onToggleActive={handleToggle}
        isToggling={false}
      />
    );

    fireEvent.click(
      screen.getByRole('switch', { name: /deactivate standard/i })
    );

    expect(handleToggle).toHaveBeenCalledWith(false);
  });

  it('disables the switch while a toggle is in flight', () => {
    const rate = makeRate({ active: true });
    render(
      <RateRow
        rate={rate}
        onEdit={vi.fn()}
        onDeleteRequested={vi.fn()}
        onToggleActive={vi.fn()}
        isToggling={true}
      />
    );

    expect(
      screen.getByRole('switch', { name: /deactivate standard/i })
    ).toBeDisabled();
  });
});
