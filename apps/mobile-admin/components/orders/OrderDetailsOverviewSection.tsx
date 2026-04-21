import { View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { OrderDetailsCustomerCard } from './OrderDetailsCustomerCard';
import { OrderDetailsStatusCard } from './OrderDetailsStatusCard';
import type { OrderSourceInfo } from './order-details.types';

interface OrderDetailsOverviewSectionProps {
  colors: ThemeColors;
  createdAtLabel: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string | null;
  isGeneratingReceipt: boolean;
  onCall: () => void;
  onEmail: () => void;
  onSendOrderDetailsToRider: () => void;
  onSendReceipt: () => void;
  onSendRiderToCustomer: () => void;
  onWhatsApp: () => void;
  recordedByName?: string | null;
  shippingColor: string;
  shippingConfig: { icon: string; label: string };
  shippingStatus: string;
  showPostShipmentActions: boolean;
  source?: string | null;
  sourceInfo: OrderSourceInfo;
  updatedAtLabel: string;
}

export function OrderDetailsOverviewSection({
  colors,
  createdAtLabel,
  customerEmail,
  customerName,
  customerPhone,
  isGeneratingReceipt,
  onCall,
  onEmail,
  onSendOrderDetailsToRider,
  onSendReceipt,
  onSendRiderToCustomer,
  onWhatsApp,
  recordedByName,
  shippingColor,
  shippingConfig,
  shippingStatus,
  showPostShipmentActions,
  source,
  sourceInfo,
  updatedAtLabel,
}: OrderDetailsOverviewSectionProps) {
  return (
    <View>
      <OrderDetailsStatusCard
        colors={colors}
        createdAtLabel={createdAtLabel}
        recordedByName={recordedByName}
        shippingColor={shippingColor}
        shippingConfig={shippingConfig}
        shippingStatus={shippingStatus}
        source={source}
        sourceInfo={sourceInfo}
        updatedAtLabel={updatedAtLabel}
      />
      <OrderDetailsCustomerCard
        colors={colors}
        customerEmail={customerEmail}
        customerName={customerName}
        customerPhone={customerPhone}
        isGeneratingReceipt={isGeneratingReceipt}
        onCall={onCall}
        onEmail={onEmail}
        onSendOrderDetailsToRider={onSendOrderDetailsToRider}
        onSendReceipt={onSendReceipt}
        onSendRiderToCustomer={onSendRiderToCustomer}
        onWhatsApp={onWhatsApp}
        showPostShipmentActions={showPostShipmentActions}
      />
    </View>
  );
}
