import { CheckoutLocationPickers } from '@/components/checkout/pickers/CheckoutLocationPickers';
import type { ColorsScheme } from './pickers/LocationPickerColors';
import type { CheckoutAddressState } from './use-checkout-address-state';

interface CheckoutLocationPickerOverlaysProps {
  colors: ColorsScheme;
  isDark: boolean;
  shipping: CheckoutAddressState['shipping'];
  watchedCity: string;
  removeClippedSubviews: boolean;
  watchedState: string;
}

export function CheckoutLocationPickerOverlays({
  colors,
  isDark,
  removeClippedSubviews,
  shipping,
  watchedCity,
  watchedState,
}: CheckoutLocationPickerOverlaysProps) {
  return (
    <CheckoutLocationPickers
      citySearch={shipping.citySearch}
      citySearchFocused={shipping.citySearchFocused}
      colors={colors}
      isDark={isDark}
      onChangeCitySearch={shipping.setCitySearch}
      onCloseCityPicker={() => {
        shipping.setShowCityPicker(false);
        shipping.setCitySearch('');
      }}
      onCloseStatePicker={() => shipping.setShowStatePicker(false)}
      onSelectCity={shipping.handleSelectCity}
      onSelectState={shipping.handleSelectState}
      onSetCitySearchFocused={shipping.setCitySearchFocused}
      removeClippedSubviews={removeClippedSubviews}
      shippingCities={shipping.shippingCities}
      shippingStates={shipping.shippingStates}
      showCityPicker={shipping.showCityPicker}
      showStatePicker={shipping.showStatePicker}
      watchedCity={watchedCity}
      watchedState={watchedState}
    />
  );
}
