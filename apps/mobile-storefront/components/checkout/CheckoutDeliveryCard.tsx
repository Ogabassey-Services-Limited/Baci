import { Ionicons } from '@expo/vector-icons';
import { Controller } from 'react-hook-form';
import { Pressable, Text, View } from 'react-native';
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';
import { BRAND } from '@/constants/Colors';
import { CHECKOUT_DELIVERY_Z_INDEX } from './CheckoutDeliveryCard.constants';
import { checkoutDeliveryCardStyles as styles } from './CheckoutDeliveryCard.styles';
import type { CheckoutDeliveryCardProps } from './CheckoutDeliveryCard.types';
import { CheckoutDeliveryDefaultCheckbox } from './CheckoutDeliveryDefaultCheckbox';
import { CheckoutDeliveryLocationPicker } from './CheckoutDeliveryLocationPicker';
import { CheckoutDeliveryNewAddressIntro } from './CheckoutDeliveryNewAddressIntro';
import { CheckoutDeliverySummary } from './CheckoutDeliverySummary';
import { SavedAddressOptions } from './SavedAddressOptions';

export function CheckoutDeliveryCard({
  colors,
  control,
  currentDeliverySummary,
  defaultSavedAddress,
  errors,
  hasSavedAddresses,
  isAddingNewAddress,
  isAuthenticated,
  isCollapsed,
  isDark,
  isLoadingCities,
  isLoadingLocations,
  isLoadingSavedAddresses,
  onAddressSelected,
  onAddressTextChanged,
  onOpenCityPicker,
  onOpenNewAddressEditor,
  onOpenStatePicker,
  onToggleCollapsed,
  onToggleSaveAsDefaultAddress,
  onUseSavedAddress,
  saveAsDefaultAddress,
  savedAddresses,
  scrollOffsetRef,
  scrollRef,
  selectedSavedAddress,
  selectedSavedAddressId,
}: CheckoutDeliveryCardProps) {
  const showCollapseAction =
    hasSavedAddresses || Boolean(currentDeliverySummary);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
          position: 'relative',
          zIndex: CHECKOUT_DELIVERY_Z_INDEX.card,
        },
      ]}
    >
      <View style={styles.cardHeaderActionRow}>
        <View style={[styles.cardHeader, styles.cardHeaderInline]}>
          <Ionicons name="location-outline" size={16} color={BRAND.primary} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Delivery
          </Text>
        </View>
        {showCollapseAction ? (
          <Pressable
            accessibilityLabel={
              isCollapsed
                ? 'Edit delivery address'
                : 'Collapse delivery address'
            }
            accessibilityRole="button"
            hitSlop={10}
            onPress={onToggleCollapsed}
            style={styles.inlineEditButton}
          >
            <View style={styles.inlineActionContent}>
              <Ionicons
                name={isCollapsed ? 'create-outline' : 'checkmark-outline'}
                size={16}
                color={BRAND.primary}
              />
              <Text style={styles.inlineActionText}>
                {isCollapsed ? 'Edit' : 'Done'}
              </Text>
            </View>
          </Pressable>
        ) : null}
      </View>

      {isCollapsed ? (
        <CheckoutDeliverySummary
          colors={colors}
          currentDeliverySummary={currentDeliverySummary}
          isDark={isDark}
          selectedSavedAddress={selectedSavedAddress}
        />
      ) : (
        <View
          style={[
            styles.cardBody,
            {
              overflow: 'visible',
              zIndex: CHECKOUT_DELIVERY_Z_INDEX.body,
            },
          ]}
        >
          <SavedAddressOptions
            colors={colors}
            defaultSavedAddress={defaultSavedAddress}
            isAddingNewAddress={isAddingNewAddress}
            isDark={isDark}
            isLoadingSavedAddresses={isLoadingSavedAddresses}
            onOpenNewAddressEditor={onOpenNewAddressEditor}
            onUseSavedAddress={onUseSavedAddress}
            savedAddresses={savedAddresses}
            selectedSavedAddress={selectedSavedAddress}
            selectedSavedAddressId={selectedSavedAddressId}
          />
          {hasSavedAddresses && !isAddingNewAddress ? (
            isAuthenticated ? (
              <CheckoutDeliveryDefaultCheckbox
                checked={saveAsDefaultAddress}
                colors={colors}
                label={
                  selectedSavedAddress?.is_default
                    ? 'Keep as default address'
                    : 'Make selected address my default'
                }
                onToggle={onToggleSaveAsDefaultAddress}
              />
            ) : null
          ) : (
            <>
              {hasSavedAddresses ? (
                <CheckoutDeliveryNewAddressIntro
                  colors={colors}
                  isDark={isDark}
                />
              ) : null}
              <Controller
                control={control}
                name="address"
                render={({ field: { onChange, value } }) => (
                  <AddressAutocomplete
                    label="Street Address"
                    onChangeText={(text) =>
                      onAddressTextChanged(text, onChange)
                    }
                    onSelect={(place) => onAddressSelected(place, onChange)}
                    placeholder="Start typing your address..."
                    scrollOffsetRef={scrollOffsetRef}
                    scrollRef={scrollRef}
                    value={value}
                  />
                )}
              />
              <View style={styles.row}>
                <CheckoutDeliveryLocationPicker
                  colors={colors}
                  control={control}
                  error={errors.city?.message}
                  isDark={isDark}
                  isLoading={isLoadingCities}
                  label="City"
                  onPress={onOpenCityPicker}
                  placeholder="Select city"
                  valueName="city"
                />
                <CheckoutDeliveryLocationPicker
                  colors={colors}
                  control={control}
                  error={errors.state?.message}
                  isDark={isDark}
                  isLoading={isLoadingLocations}
                  label="State"
                  onPress={onOpenStatePicker}
                  placeholder="Select state"
                  valueName="state"
                />
              </View>
              {isAuthenticated ? (
                <CheckoutDeliveryDefaultCheckbox
                  checked={saveAsDefaultAddress}
                  colors={colors}
                  label="Set as default address"
                  onToggle={onToggleSaveAsDefaultAddress}
                />
              ) : null}
            </>
          )}
        </View>
      )}
    </View>
  );
}
