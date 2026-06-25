import { TextInput } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { ShipmentField } from './ShipmentField';
import { styles } from './ShipmentFlowSheet.styles';
import { ShipmentInfoCard } from './ShipmentInfoCard';

interface ShipmentFlowDetailsStepProps {
  fulfillmentDetails: {
    imei: string;
    serialNumber: string;
  };
  hasExistingFulfillment: boolean;
  onFulfillmentDetailsChange: (
    field: 'imei' | 'serialNumber',
    value: string
  ) => void;
}

export function ShipmentFlowDetailsStep({
  fulfillmentDetails,
  hasExistingFulfillment,
  onFulfillmentDetailsChange,
}: ShipmentFlowDetailsStepProps) {
  const { colors } = useTheme();

  return (
    <>
      <ShipmentInfoCard
        colors={colors}
        icon="barcode-outline"
        subtitle={
          hasExistingFulfillment
            ? 'Review the device IMEI or serial number before this order is marked shipped.'
            : 'Enter the device IMEI or serial number before this order is marked shipped.'
        }
        title="IMEI or Serial Number is required for this order."
      />

      <ShipmentField
        colors={colors}
        label="IMEI Number"
        value={fulfillmentDetails.imei}
      >
        <TextInput
          keyboardType="numeric"
          maxLength={15}
          onChangeText={(value) =>
            onFulfillmentDetailsChange(
              'imei',
              value.replace(/\D/g, '').slice(0, 15)
            )
          }
          placeholder="e.g. 353456789012345"
          placeholderTextColor={colors.textSecondary}
          returnKeyType="done"
          style={[styles.input, { color: colors.text }]}
          value={fulfillmentDetails.imei}
        />
      </ShipmentField>

      <ShipmentField
        colors={colors}
        label="Serial Number"
        value={fulfillmentDetails.serialNumber}
      >
        <TextInput
          onChangeText={(value) =>
            onFulfillmentDetailsChange('serialNumber', value)
          }
          placeholder="e.g. C02ZK0ABC123"
          placeholderTextColor={colors.textSecondary}
          returnKeyType="done"
          style={[styles.input, { color: colors.text }]}
          value={fulfillmentDetails.serialNumber}
        />
      </ShipmentField>
    </>
  );
}
