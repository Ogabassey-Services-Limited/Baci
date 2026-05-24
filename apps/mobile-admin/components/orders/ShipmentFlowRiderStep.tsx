import Ionicons from "@react-native-vector-icons/ionicons/static";
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { CountryPickerModal } from '@/components/ui/CountryPickerModal';
import { useTheme } from '@/hooks/useTheme';
import {
  formatPhoneNumberForCountry,
  getNationalPhoneNumber,
  getPhoneCountryByCode,
  getPhoneCountryFromValue,
} from '@/lib/phone-country';
import { ShipmentField } from './ShipmentField';
import { styles } from './ShipmentFlowSheet.styles';
import { ShipmentInfoCard } from './ShipmentInfoCard';

interface ShipmentFlowRiderStepProps {
  onRiderPhoneChange: (value: string) => void;
  onSelectSavedRider: (phone: string) => void;
  riderPhone: string;
  savedRiders: string[];
}

export function ShipmentFlowRiderStep({
  onRiderPhoneChange,
  onSelectSavedRider,
  riderPhone,
  savedRiders,
}: ShipmentFlowRiderStepProps) {
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
            accessibilityRole="button"
            accessibilityLabel={`Select country, currently ${selectedCountry.name}`}
            accessibilityHint="Opens country selection modal"
            accessibilityState={{ expanded: showCountryModal }}
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
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={`Saved rider ${phone}`}
                  accessibilityHint="Select this saved rider"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => onSelectSavedRider(phone)}
                  style={[
                    styles.savedRiderChip,
                    {
                      backgroundColor: isSelected
                        ? colors.primaryLight
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
