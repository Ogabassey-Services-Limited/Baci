import './orders-screen-test-utils';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OrdersModals } from './OrdersModals';
import { mockOrder } from './orders-screen-test-utils';

// Render mock labels through a Text-named host so static analysis treats them as
// React Native text nodes; in jsdom this is a plain span, so getByText/click
// behavior is unchanged.
const Text = ({ children }: { children?: ReactNode }) => (
  <span>{children}</span>
);

const exportOrdersRPC = vi.hoisted(() => vi.fn());

vi.mock('@/utils/export-orders', () => ({
  orderExportTools: { exportOrdersRPC },
}));

vi.mock('@/components/ui/DateRangePicker', () => ({
  default: ({
    onSelect,
    visible,
  }: {
    onSelect: (value: string) => void;
    visible: boolean;
  }) =>
    visible ? (
      <button onClick={() => onSelect('Today')} type="button">
        <Text>Select today</Text>
      </button>
    ) : null,
}));

vi.mock('@/components/ui/OrderReportModal', () => ({
  default: ({
    onExport,
    onPresetSelect,
    visible,
  }: {
    children?: ReactNode;
    onExport: () => void;
    onPresetSelect: (preset: string) => void;
    visible: boolean;
  }) =>
    visible ? (
      <div>
        <button onClick={onExport} type="button">
          <Text>Export orders</Text>
        </button>
        <button onClick={() => onPresetSelect('Last 7 Days')} type="button">
          <Text>Preset 7 days</Text>
        </button>
      </div>
    ) : null,
}));

describe('OrdersModals', () => {
  it('wires date and report modal actions', () => {
    const onDateFilterSelect = vi.fn();
    const onDateRangeChange = vi.fn();

    render(
      <OrdersModals
        businessName="Baci"
        dateRange={null}
        dateRangeLabel="All Time"
        onCloseDatePicker={vi.fn()}
        onCloseReport={vi.fn()}
        onDateFilterSelect={onDateFilterSelect}
        onDateRangeChange={onDateRangeChange}
        onOpenDatePickerFromReport={vi.fn()}
        orders={[mockOrder]}
        showDatePicker={true}
        showReportModal={true}
      />
    );

    fireEvent.click(screen.getByText('Select today'));
    fireEvent.click(screen.getByText('Export orders'));
    fireEvent.click(screen.getByText('Preset 7 days'));

    expect(onDateFilterSelect).toHaveBeenCalledWith('Today');
    expect(exportOrdersRPC).toHaveBeenCalledWith([mockOrder]);
    expect(onDateRangeChange).toHaveBeenCalledWith({
      start: expect.any(Date),
      end: expect.any(Date),
    });
  });
});
