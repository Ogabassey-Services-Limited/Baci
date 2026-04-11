import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { CountryPickerModal } from '@/components/ui/CountryPickerModal';
import { useTheme } from '@/hooks/useTheme';
import type { ShipmentCompletionMode } from '@/lib/order-shipment';
import {
  formatPhoneNumberForCountry,
  getNationalPhoneNumber,
  getPhoneCountryByCode,
  getPhoneCountryFromValue,
} from '@/lib/phone-country';
import { styles } from './ShipmentFlowSheet.styles';
import {
  ShipmentField,
  ShipmentInfoCard,
  ShipmentOptionCard,
} from './ShipmentFlowSheetCards';

export function ShipmentFlowDetailsStep({
  fulfillmentDetails,
  hasExistingFulfillment,
  onFulfillmentDetailsChange,
}: {
  fulfillmentDetails: {
    imei: string;
    serialNumber: string;
  };
  hasExistingFulfillment: boolean;
  onFulfillmentDetailsChange: (
    field: 'imei' | 'serialNumber',
    value: string
  ) => void;
}) {
  const { colors } = useTheme();

  return (
    <>
      <ShipmentInfoCard
        colors={colors}
        icon="barcode-outline"
        subtitle={
          hasExistingFulfillment
            ? 'Review the device identifiers before this order is marked shipped.'
            : 'Enter the device identifiers before this order is marked shipped.'
        }
        title="IMEI and serial details are required for this order."
      />

      <ShipmentField
        colors={colors}
        label="IMEI Number"
        required
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
          placeholder="Optional serial number"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { color: colors.text }]}
          value={fulfillmentDetails.serialNumber}
        />
      </ShipmentField>
    </>
  );
}

export function ShipmentFlowMethodStep({
  canUseProvider,
  onModeChange,
  providerLabel,
  selectedMode,
}: {
  canUseProvider: boolean;
  onModeChange: (mode: ShipmentCompletionMode) => void;
  providerLabel: string | null;
  selectedMode: ShipmentCompletionMode;
}) {
  const { colors } = useTheme();
  const providerDescription = providerLabel
    ? `This will book the shipment with ${providerLabel} using the saved checkout quote for this order.`
    : 'This will use the selected provider and saved checkout quote for this order.';

  return (
    <>
      <ShipmentInfoCard
        colors={colors}
        icon="cube-outline"
        subtitle="You can still override the provider and use your own rider for this shipment."
        title="Choose how this order should leave your store."
      />

      <ShipmentOptionCard
        colors={colors}
        description={
          !canUseProvider
            ? providerLabel
              ? `${providerLabel} was selected for checkout, but this order does not have a saved quote to book against anymore.`
              : 'No provider-backed shipping quote is currently saved on this order.'
            : providerDescription
        }
        disabled={!canUseProvider}
        icon="paper-plane-outline"
        onPress={() => onModeChange('provider')}
        selected={selectedMode === 'provider'}
        title={providerLabel ? `Use ${providerLabel}` : 'Use Selected Provider'}
      />

      <ShipmentOptionCard
        colors={colors}
        description="Use your own dispatch rider instead. We’ll save the rider number for reuse and you can share it with the customer after dispatch."
        icon="bicycle-outline"
        onPress={() => onModeChange('self_fulfillment')}
        selected={selectedMode === 'self_fulfillment'}
        title="Self Fulfill"
      />
    </>
  );
}

export function ShipmentFlowRiderStep({
  onRiderPhoneChange,
  onSelectSavedRider,
  riderPhone,
  savedRiders,
}: {
  onRiderPhoneChange: (value: string) => void;
  onSelectSavedRider: (phone: string) => void;
  riderPhone: string;
  savedRiders: string[];
}) {
  const { colors } = useTheme();
  const [showCountryModal, setShowCountryModal] = useState(false);
  const selectedCountry = getPhoneCountryFromValue(riderPhone);
  const nationalNumber = getNationalPhoneNumber(riderPhone);

  return (
    <>
      <ShipmentInfoCard
        colors={colors}
        icon="logo-whatsapp"
        subtitle="Mark the order shipped first. After shipment succeeds, you'll get a WhatsApp button to send the order details to the rider."
        title="Enter the rider's WhatsApp number."
      />

      <ShipmentField
        colors={colors}
        label="Dispatch Rider Number"
        value={riderPhone}
        withInnerPadding={false}
      >
        <View style={styles.riderPhoneRow}>
          <Pressable
            onPress={() => setShowCountryModal(true)}
            style={[
              styles.riderCountryButton,
              { borderRightColor: colors.border },
            ]}
          >
            <Text style={styles.riderCountryFlag}>
              {selectedCountry.flagEmoji}
            </Text>
            <Text style={[styles.riderCountryCode, { color: colors.text }]}>
              +{selectedCountry.callingCode}
            </Text>
            <Ionicons
              name="chevron-down"
              size={16}
              color={colors.textSecondary}
            />
          </Pressable>

          <TextInput
            keyboardType="phone-pad"
            onChangeText={(value) =>
              onRiderPhoneChange(
                formatPhoneNumberForCountry(value, selectedCountry)
              )
            }
            placeholder="Dispatch rider number"
            placeholderTextColor={colors.textSecondary}
            style={[styles.riderPhoneInput, { color: colors.text }]}
            value={nationalNumber}
          />
        </View>
      </ShipmentField>

      <CountryPickerModal
        visible={showCountryModal}
        selectedCountry={selectedCountry.code}
        onSelect={(country) => {
          const nextCountry = getPhoneCountryByCode(country.code);
          onRiderPhoneChange(
            formatPhoneNumberForCountry(nationalNumber, nextCountry)
          );
          setShowCountryModal(false);
        }}
        onClose={() => setShowCountryModal(false)}
      />

      {savedRiders.length > 0 ? (
        <View style={styles.savedRidersSection}>
          <Text
            style={[styles.savedRidersLabel, { color: colors.textSecondary }]}
          >
            Saved dispatch riders
          </Text>
          <View style={styles.savedRidersWrap}>
            {savedRiders.map((phone) => {
              const isSelected = riderPhone === phone;
              return (
                <Pressable
                  key={phone}
                  onPress={() => onSelectSavedRider(phone)}
                  style={[
                    styles.savedRiderChip,
                    {
                      backgroundColor: isSelected
                        ? `${colors.primary}12`
                        : colors.backgroundLight,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.savedRiderChipText,
                      {
                        color: isSelected ? colors.primary : colors.text,
                      },
                    ]}
                  >
                    {phone}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </>
  );
}
