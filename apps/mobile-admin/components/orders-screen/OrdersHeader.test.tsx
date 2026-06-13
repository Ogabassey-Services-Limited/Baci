import './orders-screen-test-utils';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrdersHeader } from './OrdersHeader';
import { mockColors } from './orders-screen-test-utils';

describe('OrdersHeader', () => {
  it('opens report and date range actions', () => {
    const onOpenReport = vi.fn();
    const onOpenDatePicker = vi.fn();

    render(
      <OrdersHeader
        colors={mockColors}
        onOpenDatePicker={onOpenDatePicker}
        onOpenReport={onOpenReport}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Generate order report' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Filter by date range' })
    );

    expect(onOpenReport).toHaveBeenCalledOnce();
    expect(onOpenDatePicker).toHaveBeenCalledOnce();
  });
});
