import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BillPaymentBillerList } from '@/components/storefront/ogabassey/components/utility/BillPaymentBillerList';

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

describe('BillPaymentBillerList', () => {
  it('renders loading state', () => {
    render(
      <BillPaymentBillerList
        billers={[]}
        isLoading={true}
        label="TV Subscription"
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent(/loading providers/i);
  });

  it('renders an empty state and label when no billers are available', () => {
    render(
      <BillPaymentBillerList
        billers={[]}
        isLoading={false}
        label="TV Subscription"
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText('Select TV Subscription Provider')).toBeInTheDocument();
    expect(
      screen.getByText('No providers available for TV Subscription')
    ).toBeInTheDocument();
  });

  it('renders billers and selects one', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const biller = {
      billerId: 'dstv',
      billerName: 'DStv',
      billerType: 'cable',
      categoryId: '1',
      categoryName: 'CableTv',
    };

    render(
      <BillPaymentBillerList
        billers={[biller]}
        isLoading={false}
        label="TV Subscription"
        onSelect={onSelect}
      />
    );

    await user.click(screen.getByRole('radio', { name: 'DStv' }));

    expect(onSelect).toHaveBeenCalledWith(biller);
  });

  it('marks the selected biller and supports arrow-key navigation', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const billers = [
      {
        billerId: 'dstv',
        billerName: 'DStv',
        billerType: 'cable',
        categoryId: '1',
        categoryName: 'CableTv',
      },
      {
        billerId: 'gotv',
        billerName: 'GOtv',
        billerType: 'cable',
        categoryId: '1',
        categoryName: 'CableTv',
      },
    ];

    render(
      <BillPaymentBillerList
        billers={billers}
        isLoading={false}
        label="TV Subscription"
        selectedBillerId="dstv"
        onSelect={onSelect}
      />
    );

    const selected = screen.getByRole('radio', { name: 'DStv' });
    const next = screen.getByRole('radio', { name: 'GOtv' });

    expect(selected).toHaveAttribute('aria-checked', 'true');
    selected.focus();
    await user.keyboard('{ArrowRight}');

    expect(onSelect).toHaveBeenCalledWith(billers[1]);
    expect(next).toHaveFocus();
  });
});
