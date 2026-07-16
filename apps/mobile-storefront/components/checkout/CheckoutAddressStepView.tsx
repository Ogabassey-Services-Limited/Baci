import type { Control, FieldErrors } from 'react-hook-form';
import { ScrollView, Text, View } from 'react-native';
import { CheckoutContactCard } from '@/components/checkout/CheckoutContactCard';
import { CheckoutDeliveryCard } from '@/components/checkout/CheckoutDeliveryCard';
import type { CheckoutDeliveryCardProps } from '@/components/checkout/CheckoutDeliveryCard.types';
import { CheckoutFormField } from '@/components/checkout/CheckoutFormField';
import {
  getPickupStationMode,
  getStationPickupQuote,
  isProviderStationPickupQuote,
} from '@/components/checkout/checkout-station-pickup';
import {
  AIRPORT_DELIVERY_ESTIMATE,
  AIRPORT_DELIVERY_FEE,
  AIRPORT_QUOTE_ID,
  getDeliveryMethodSummary,
  isGiglGoFasterQuote,
  LAGOS_ROAD_DELIVERY_ESTIMATE,
} from '@/components/checkout/checkout-step-helpers';
import { DeliveryMethodCard } from '@/components/checkout/DeliveryMethodCard';
import { DeliveryNotesCard } from '@/components/checkout/DeliveryNotesCard';
import { PickupLocationOptions } from '@/components/checkout/PickupLocationOptions';
import { ShippingQuotesCard } from '@/components/checkout/ShippingQuotesCard';
import type Colors from '@/constants/Colors';
import type { SavedAddress } from '@/lib/checkout-saved-address';
import type { ShippingAddressInput } from '@/lib/validation';
import { checkoutScreenViewStyles as styles } from './CheckoutScreenView.styles';
import {
  MERCHANT_PICKUP_QUOTE_ID,
  type MerchantPickupLocation,
} from './merchant-pickup-location';
import type { DeliveryMethod, ShippingQuote } from './types';

type ColorsScheme = (typeof Colors)['light'];

interface CheckoutAddressStepViewProps {
  accountPassword: string;
  colors: ColorsScheme;
  contactSummary: string;
  control: Control<ShippingAddressInput>;
  currentDeliverySummary: string;
  defaultSavedAddress: SavedAddress | null;
  deliveryMethod: DeliveryMethod;
  errors: FieldErrors<ShippingAddressInput>;
  formContentPaddingBottom: number;
  hasContactIdentity: boolean;
  hasSavedAddresses: boolean;
  isAddingNewAddress: boolean;
  isAuthenticated: boolean;
  isContactCollapsed: boolean;
  isDark: boolean;
  isDeliveryCollapsed: boolean;
  isLoadingCities: boolean;
  isLoadingLocations: boolean;
  isLoadingQuotes: boolean;
  isLoadingSavedAddresses: boolean;
  merchantPickupLocation?: MerchantPickupLocation;
  onAddressSelected: CheckoutDeliveryCardProps['onAddressSelected'];
  onAddressTextChanged: CheckoutDeliveryCardProps['onAddressTextChanged'];
  onChangeAccountPassword: (value: string) => void;
  onOpenCityPicker: () => void;
  onOpenNewAddressEditor: () => void;
  onOpenStatePicker: () => void;
  onRetryQuotes: () => void;
  onSelectDeliveryMethod: (method: DeliveryMethod) => void;
  onSelectQuote: (quoteId: string) => void;
  onToggleContactCollapsed: () => void;
  onToggleDeliveryCollapsed: () => void;
  onToggleSaveAsDefaultAddress: () => void;
  onToggleSaveDetails: () => void;
  onUseSavedAddress: CheckoutDeliveryCardProps['onUseSavedAddress'];
  phone: string;
  saveAsDefaultAddress: boolean;
  saveDetails: boolean;
  savedAddresses: SavedAddress[];
  selectedQuote: ShippingQuote | undefined;
  selectedQuoteId: string;
  selectedSavedAddress: SavedAddress | null;
  selectedSavedAddressId: string | null;
  shippingQuotes: ShippingQuote[];
  watchedCity: string;
  watchedEmail: string;
  watchedState: string;
}

export function CheckoutAddressStepView({
  accountPassword,
  colors,
  contactSummary,
  control,
  currentDeliverySummary,
  defaultSavedAddress,
  deliveryMethod,
  errors,
  formContentPaddingBottom,
  hasContactIdentity,
  hasSavedAddresses,
  isAddingNewAddress,
  isAuthenticated,
  isContactCollapsed,
  isDark,
  isDeliveryCollapsed,
  isLoadingCities,
  isLoadingLocations,
  isLoadingQuotes,
  isLoadingSavedAddresses,
  merchantPickupLocation,
  onAddressSelected,
  onAddressTextChanged,
  onChangeAccountPassword,
  onOpenCityPicker,
  onOpenNewAddressEditor,
  onOpenStatePicker,
  onRetryQuotes,
  onSelectDeliveryMethod,
  onSelectQuote,
  onToggleContactCollapsed,
  onToggleDeliveryCollapsed,
  onToggleSaveAsDefaultAddress,
  onToggleSaveDetails,
  onUseSavedAddress,
  phone,
  saveAsDefaultAddress,
  saveDetails,
  savedAddresses,
  selectedQuote,
  selectedQuoteId,
  selectedSavedAddress,
  selectedSavedAddressId,
  shippingQuotes,
  watchedCity,
  watchedEmail,
  watchedState,
}: CheckoutAddressStepViewProps) {
  const stationPickupQuote = getStationPickupQuote(shippingQuotes);
  const doorSelectedQuote =
    selectedQuote != null && !isProviderStationPickupQuote(selectedQuote)
      ? selectedQuote
      : undefined;
  const doorShippingQuotes = shippingQuotes.filter(
    (quote) =>
      !isProviderStationPickupQuote(quote) && !isGiglGoFasterQuote(quote)
  );
  const airShippingQuotes = shippingQuotes.filter(isGiglGoFasterQuote);
  const providerPickupQuotes = shippingQuotes.filter(
    isProviderStationPickupQuote
  );
  const canChooseDeliveryMethod = Boolean(watchedState && watchedCity);
  const { usesMerchantPickup, usesProviderPickup } = getPickupStationMode({
    city: watchedCity,
    deliveryMethod,
    state: watchedState,
    stationPickupQuote,
  });
  const shouldShowShippingQuotes =
    (deliveryMethod === 'door' ||
      deliveryMethod === 'airport' ||
      usesProviderPickup) &&
    Boolean(watchedState && watchedCity);
  const airportLocation = watchedCity.trim() || watchedState.trim();
  const localAirportQuote: ShippingQuote = {
    carrierName: 'By Air',
    deliveryRange: AIRPORT_DELIVERY_ESTIMATE,
    displayName: `${airportLocation ? `${airportLocation} ` : ''}Airport Delivery`,
    id: AIRPORT_QUOTE_ID,
    price: AIRPORT_DELIVERY_FEE,
  };
  const effectiveSelectedQuoteId =
    deliveryMethod === 'airport' && !isGiglGoFasterQuote(selectedQuote)
      ? AIRPORT_QUOTE_ID
      : selectedQuoteId;

  return (
    <ScrollView
      style={styles.formContainer}
      contentContainerStyle={[
        styles.formContent,
        { paddingBottom: formContentPaddingBottom },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Delivery Address
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          {isAuthenticated
            ? 'Choose how this order should be delivered.'
            : 'Add your contact and delivery details to continue.'}
        </Text>
      </View>

      <CheckoutContactCard
        accountPassword={accountPassword}
        colors={colors}
        contactSummary={contactSummary}
        control={control}
        email={watchedEmail}
        errors={errors}
        hasContactIdentity={hasContactIdentity}
        isAuthenticated={isAuthenticated}
        isCollapsed={isContactCollapsed}
        isDark={isDark}
        onChangeAccountPassword={onChangeAccountPassword}
        onToggleCollapsed={onToggleContactCollapsed}
        onToggleSaveDetails={onToggleSaveDetails}
        phone={phone}
        saveDetails={saveDetails}
      />

      {deliveryMethod !== 'pickup_station' && (
        <CheckoutDeliveryCard
          colors={colors}
          control={control}
          currentDeliverySummary={currentDeliverySummary}
          defaultSavedAddress={defaultSavedAddress}
          errors={errors}
          hasSavedAddresses={hasSavedAddresses}
          isAddingNewAddress={isAddingNewAddress}
          isAuthenticated={isAuthenticated}
          isCollapsed={isDeliveryCollapsed}
          isDark={isDark}
          isLoadingCities={isLoadingCities}
          isLoadingLocations={isLoadingLocations}
          isLoadingSavedAddresses={isLoadingSavedAddresses}
          onAddressSelected={onAddressSelected}
          onAddressTextChanged={onAddressTextChanged}
          onOpenCityPicker={onOpenCityPicker}
          onOpenNewAddressEditor={onOpenNewAddressEditor}
          onOpenStatePicker={onOpenStatePicker}
          onToggleCollapsed={onToggleDeliveryCollapsed}
          onToggleSaveAsDefaultAddress={onToggleSaveAsDefaultAddress}
          onUseSavedAddress={onUseSavedAddress}
          saveAsDefaultAddress={saveAsDefaultAddress}
          savedAddresses={savedAddresses}
          selectedSavedAddress={selectedSavedAddress}
          selectedSavedAddressId={selectedSavedAddressId}
        />
      )}

      {canChooseDeliveryMethod && (
        <DeliveryMethodCard
          colors={colors}
          isDark={isDark}
          selectedMethod={deliveryMethod}
          onSelectMethod={onSelectDeliveryMethod}
          deliveryCity={watchedCity}
          deliveryState={watchedState}
          doorSubtitle={
            doorSelectedQuote != null
              ? getDeliveryMethodSummary(
                  'door',
                  doorSelectedQuote,
                  watchedState
                )
              : 'Rates loaded after you enter your address'
          }
          airportFee={AIRPORT_DELIVERY_FEE}
          pickupStationQuote={stationPickupQuote}
          merchantPickupLocation={merchantPickupLocation}
        >
          {deliveryMethod === 'pickup_station' ? (
            <PickupLocationOptions
              colors={colors}
              isDark={isDark}
              isLoading={isLoadingQuotes}
              merchantLocation={
                usesMerchantPickup ? merchantPickupLocation : undefined
              }
              onRetry={onRetryQuotes}
              onSelect={onSelectQuote}
              providerQuotes={providerPickupQuotes}
              selectedQuoteId={
                selectedQuoteId ||
                (usesMerchantPickup && merchantPickupLocation
                  ? MERCHANT_PICKUP_QUOTE_ID
                  : '')
              }
            />
          ) : shouldShowShippingQuotes ? (
            <ShippingQuotesCard
              embedded
              colors={colors}
              estimateOverride={
                deliveryMethod === 'airport'
                  ? AIRPORT_DELIVERY_ESTIMATE
                  : watchedState.trim().toLowerCase() === 'lagos'
                    ? LAGOS_ROAD_DELIVERY_ESTIMATE
                    : undefined
              }
              isDark={isDark}
              isLoadingQuotes={isLoadingQuotes}
              shippingQuotes={
                usesProviderPickup
                  ? providerPickupQuotes
                  : deliveryMethod === 'airport'
                    ? [localAirportQuote, ...airShippingQuotes]
                    : doorShippingQuotes
              }
              stationPickupQuote={
                usesProviderPickup ? undefined : stationPickupQuote
              }
              selectedQuoteId={effectiveSelectedQuoteId}
              onSelectQuote={onSelectQuote}
              onRetryQuotes={onRetryQuotes}
            />
          ) : undefined}
        </DeliveryMethodCard>
      )}

      <DeliveryNotesCard colors={colors} isDark={isDark}>
        <CheckoutFormField
          name="notes"
          label=""
          placeholder="Any special instructions for delivery"
          multiline
          control={control}
          errors={errors}
          colors={colors}
          isDark={isDark}
        />
      </DeliveryNotesCard>
    </ScrollView>
  );
}
