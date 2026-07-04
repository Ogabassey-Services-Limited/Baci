import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { ShipmentFulfillmentDetails } from '@/lib/order-shipment';
import { withTwentyPercentAlpha } from '@/utils/colors/withTwentyPercentAlpha';
import { ShipmentField } from './ShipmentField';
import { identifierStyles } from './ShipmentFlowIdentifier.styles';
import { styles } from './ShipmentFlowSheet.styles';
import { ShipmentInfoCard } from './ShipmentInfoCard';

function normalizeSerialNumber(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

interface ShipmentFlowDetailsStepProps {
  fulfillmentDetails: ShipmentFulfillmentDetails;
  fulfillmentItemIndex: number;
  hasExistingFulfillment: boolean;
  onFulfillmentDetailsChange: (
    field: 'imei' | 'serialNumber',
    value: string
  ) => void;
  onScanIdentifier: (field: 'imei' | 'serialNumber') => void;
}

export function ShipmentFlowDetailsStep({
  fulfillmentDetails,
  fulfillmentItemIndex,
  hasExistingFulfillment,
  onFulfillmentDetailsChange,
  onScanIdentifier,
}: ShipmentFlowDetailsStepProps) {
  const { colors } = useTheme();
  const activeItem = fulfillmentDetails.items[fulfillmentItemIndex];
  const imei = activeItem?.imei ?? fulfillmentDetails.imei;
  const serialNumber =
    activeItem?.serialNumber ?? fulfillmentDetails.serialNumber;
  const totalItems = fulfillmentDetails.items.length;
  const activeItemLabel = activeItem
    ? `${activeItem.productName}${
        activeItem.unitCount > 1
          ? ` (${activeItem.unitIndex + 1} of ${activeItem.unitCount})`
          : ''
      }`
    : null;

  return (
    <>
      <ShipmentInfoCard
        colors={colors}
        icon="barcode-outline"
        subtitle={
          activeItemLabel
            ? `${hasExistingFulfillment ? 'Review' : 'Enter'} identifier ${
                fulfillmentItemIndex + 1
              } of ${totalItems}: ${activeItemLabel}.`
            : hasExistingFulfillment
              ? 'Review the device IMEI or serial number before this order is marked shipped.'
              : 'Enter the device IMEI or serial number before this order is marked shipped.'
        }
        title={
          activeItemLabel
            ? 'Identifier required for this item.'
            : 'IMEI or Serial Number is required for this order.'
        }
      />

      {activeItemLabel ? (
        <View
          style={[
            styles.fulfillmentItemBanner,
            { backgroundColor: colors.backgroundLight },
          ]}
        >
          <Text style={[styles.fulfillmentItemLabel, { color: colors.text }]}>
            {activeItemLabel}
          </Text>
          <Text
            style={[
              styles.fulfillmentItemCount,
              { color: colors.textSecondary },
            ]}
          >
            Item {fulfillmentItemIndex + 1} of {totalItems}
          </Text>
        </View>
      ) : null}

      <ShipmentField
        colors={colors}
        label="IMEI Number"
        value={imei}
        withInnerPadding={false}
      >
        <View style={identifierStyles.inputRow}>
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
            style={[identifierStyles.input, { color: colors.text }]}
            value={imei}
          />
          <Pressable
            accessibilityLabel="Scan IMEI"
            accessibilityRole="button"
            onPress={() => onScanIdentifier('imei')}
            style={[
              identifierStyles.scanButton,
              {
                backgroundColor: withTwentyPercentAlpha(colors.primary),
                borderColor: colors.primary,
              },
            ]}
          >
            <Ionicons color={colors.primary} name="barcode-outline" size={20} />
            <Text
              style={[
                identifierStyles.scanButtonText,
                { color: colors.primary },
              ]}
            >
              Scan
            </Text>
          </Pressable>
        </View>
      </ShipmentField>

      <ShipmentField
        colors={colors}
        label="Serial Number"
        value={serialNumber}
        withInnerPadding={false}
      >
        <View style={identifierStyles.inputRow}>
          <TextInput
            autoCapitalize="characters"
            autoCorrect={false}
            onChangeText={(value) =>
              onFulfillmentDetailsChange(
                'serialNumber',
                normalizeSerialNumber(value)
              )
            }
            placeholder="e.g. C02ZK0ABC123"
            placeholderTextColor={colors.textSecondary}
            returnKeyType="done"
            style={[identifierStyles.input, { color: colors.text }]}
            value={serialNumber}
          />
          <Pressable
            accessibilityLabel="Scan serial number"
            accessibilityRole="button"
            onPress={() => onScanIdentifier('serialNumber')}
            style={[
              identifierStyles.scanButton,
              {
                backgroundColor: withTwentyPercentAlpha(colors.primary),
                borderColor: colors.primary,
              },
            ]}
          >
            <Ionicons color={colors.primary} name="barcode-outline" size={20} />
            <Text
              style={[
                identifierStyles.scanButtonText,
                { color: colors.primary },
              ]}
            >
              Scan
            </Text>
          </Pressable>
        </View>
      </ShipmentField>
    </>
  );
}
