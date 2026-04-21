import { View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { OrderDetailsItemsCard } from './OrderDetailsItemsCard';
import { OrderDetailsPaymentCard } from './OrderDetailsPaymentCard';
import type { OrderDetailsItem } from './order-details.types';

interface OrderDetailsItemsAndPaymentSectionProps {
  amountPaid: number;
  balance: number;
  colors: ThemeColors;
  discountAmount: number;
  formatPrice: (amount: number) => string;
  items: OrderDetailsItem[];
  onRecordPayment: () => void;
  onRequestPayment: () => void;
  onSelectItem: (item: OrderDetailsItem) => void;
  paymentColor: string;
  paymentLabel: string;
  paymentMethod?: string | null;
  paymentStatus: string;
  shippingFee?: number | null;
  subtotal?: number | null;
  total: number;
}

export function OrderDetailsItemsAndPaymentSection({
  amountPaid,
  balance,
  colors,
  discountAmount,
  formatPrice,
  items,
  onRecordPayment,
  onRequestPayment,
  onSelectItem,
  paymentColor,
  paymentLabel,
  paymentMethod,
  paymentStatus,
  shippingFee,
  subtotal,
  total,
}: OrderDetailsItemsAndPaymentSectionProps) {
  return (
    <View>
      <OrderDetailsItemsCard
        colors={colors}
        formatPrice={formatPrice}
        items={items}
        onSelectItem={onSelectItem}
      />
      <OrderDetailsPaymentCard
        amountPaid={amountPaid}
        balance={balance}
        colors={colors}
        discountAmount={discountAmount}
        formatPrice={formatPrice}
        onRecordPayment={onRecordPayment}
        onRequestPayment={onRequestPayment}
        paymentColor={paymentColor}
        paymentLabel={paymentLabel}
        paymentMethod={paymentMethod}
        paymentStatus={paymentStatus}
        shippingFee={shippingFee}
        subtotal={subtotal}
        total={total}
      />
    </View>
  );
}
