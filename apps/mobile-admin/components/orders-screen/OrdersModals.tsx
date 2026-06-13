import DateRangePicker from '@/components/ui/DateRangePicker';
import OrderReportModal from '@/components/ui/OrderReportModal';
import type { Order } from '@/hooks/useOrders';
import { orderExportTools } from '@/utils/export-orders';
import { getPresetDateRange } from './get-preset-date-range';

interface OrdersModalsProps {
  showDatePicker: boolean;
  showReportModal: boolean;
  dateRange: string | { start: Date; end: Date } | null;
  dateRangeLabel: string;
  orders: Order[];
  businessName: string;
  logoUrl?: string;
  onCloseDatePicker: () => void;
  onCloseReport: () => void;
  onDateFilterSelect: (
    filter: string | { start: Date | null; end: Date | null } | null
  ) => void;
  onDateRangeChange: (dateRange: { start: Date; end: Date }) => void;
  onOpenDatePickerFromReport: () => void;
}

export function OrdersModals({
  showDatePicker,
  showReportModal,
  dateRange,
  dateRangeLabel,
  orders,
  businessName,
  logoUrl,
  onCloseDatePicker,
  onCloseReport,
  onDateFilterSelect,
  onDateRangeChange,
  onOpenDatePickerFromReport,
}: OrdersModalsProps) {
  return (
    <>
      <DateRangePicker
        visible={showDatePicker}
        onClose={onCloseDatePicker}
        onSelect={onDateFilterSelect}
        currentFilter={dateRange}
      />
      <OrderReportModal
        visible={showReportModal}
        onClose={onCloseReport}
        onExport={() => orderExportTools.exportOrdersRPC(orders)}
        orders={orders}
        dateRangeLabel={dateRangeLabel}
        businessName={businessName}
        logoUrl={logoUrl}
        onDateSelect={onOpenDatePickerFromReport}
        onPresetSelect={(preset) =>
          onDateRangeChange(getPresetDateRange(preset))
        }
      />
    </>
  );
}
