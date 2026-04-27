import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BillItemLevelOptions } from '@/components/storefront/ogabassey/components/utility/BillItemLevelOptions';

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

describe('BillItemLevelOptions', () => {
  it('renders only the level label when no options are available', () => {
    const onSelect = vi.fn();

    render(
      <BillItemLevelOptions
        label="Package"
        level={{ depth: 1, options: [], selectedCode: null }}
        onSelect={onSelect}
      />
    );

    expect(screen.getByText('Package')).toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders bill items and emits the selected depth and item', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const item = {
      itemCode: 'compact',
      itemName: 'Compact',
      amount: 15_000,
      itemCurrencySymbol: 'NGN',
      isAmountFixed: true,
      itemFee: 0,
    };

    render(
      <BillItemLevelOptions
        label="Package"
        level={{ depth: 1, options: [item], selectedCode: null }}
        onSelect={onSelect}
      />
    );

    expect(screen.getByText('Package')).toBeInTheDocument();
    expect(screen.getByText('₦15,000')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /compact/i }));

    expect(onSelect).toHaveBeenCalledWith(1, item);
  });

  it('checks the pre-selected option on render', () => {
    const items = [
      {
        itemCode: 'compact',
        itemName: 'Compact',
        amount: 15_000,
        itemCurrencySymbol: 'NGN',
        isAmountFixed: true,
        itemFee: 0,
      },
      {
        itemCode: 'premium',
        itemName: 'Premium',
        amount: 20_000,
        itemCurrencySymbol: 'NGN',
        isAmountFixed: true,
        itemFee: 0,
      },
    ];

    render(
      <BillItemLevelOptions
        label="Package"
        level={{ depth: 1, options: items, selectedCode: 'premium' }}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByRole('radio', { name: /premium/i })).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  it('renders multiple fixed and variable options', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const items = [
      {
        itemCode: 'residential',
        itemName: 'Residential',
        amount: 0,
        itemCurrencySymbol: 'NGN',
        isAmountFixed: false,
        itemFee: 0,
      },
      {
        itemCode: 'commercial',
        itemName: 'Commercial',
        amount: 5_000,
        itemCurrencySymbol: 'NGN',
        isAmountFixed: true,
        itemFee: 0,
      },
    ];

    render(
      <BillItemLevelOptions
        label="Meter Type"
        level={{ depth: 2, options: items, selectedCode: null }}
        onSelect={onSelect}
      />
    );

    expect(screen.getByText('Residential')).toBeInTheDocument();
    expect(screen.getByText('Commercial')).toBeInTheDocument();
    expect(screen.queryByText('₦0')).toBeNull();
    expect(screen.getByText('₦5,000')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /residential/i }));
    await user.click(screen.getByRole('radio', { name: /commercial/i }));

    expect(onSelect).toHaveBeenNthCalledWith(1, 2, items[0]);
    expect(onSelect).toHaveBeenNthCalledWith(2, 2, items[1]);
  });
});
