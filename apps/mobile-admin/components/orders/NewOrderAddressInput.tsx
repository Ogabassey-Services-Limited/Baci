import { useRef } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
import { styles } from './new-order.styles';

interface NewOrderAddressInputProps {
  controller: Pick<
    ReturnType<typeof useNewOrderController>,
    'colors' | 'deliveryInfo' | 'setDeliveryInfo'
  >;
  googleMapsApiKey: string | undefined;
}

function clearGeocodedFields<T extends object>(previous: T): T {
  return {
    ...previous,
    city: '',
    state: '',
    country: '',
    countryCode: '',
    postalCode: '',
    latitude: undefined,
    longitude: undefined,
  };
}

export function NewOrderAddressInput({
  controller,
  googleMapsApiKey,
}: NewOrderAddressInputProps) {
  const { colors, deliveryInfo, setDeliveryInfo } = controller;
  const hasGoogleMapsApiKey = Boolean(googleMapsApiKey);
  const selectedDescriptionRef = useRef<string | null>(null);

  return (
    <View style={{ zIndex: 5 }}>
      <Text
        style={[styles.label, { color: colors.textSecondary, marginBottom: 4 }]}
      >
        Delivery Address
      </Text>
      {hasGoogleMapsApiKey ? (
        <GooglePlacesAutocomplete
          debounce={300}
          enablePoweredByContainer={false}
          fetchDetails
          keyboardShouldPersistTaps="handled"
          listViewDisplayed="auto"
          nearbyPlacesAPI="GooglePlacesSearch"
          onFail={(error) => {
            if (__DEV__) {
              console.log('Google Places Error:', error);
            }
            Alert.alert(
              'Address search failed',
              'Try entering the address manually.'
            );
          }}
          onNotFound={() => {
            if (__DEV__) {
              console.log('Google Places: No results');
            }
            Alert.alert(
              'Address not found',
              'Try refining the address or enter it manually.'
            );
          }}
          onPress={(data, details = null) => {
            selectedDescriptionRef.current = data.description;
            if (!details) {
              setDeliveryInfo((previous) => ({
                ...clearGeocodedFields(previous),
                address: data.description,
              }));
              return;
            }

            let foundCity = '';
            let foundState = '';
            let foundCountry = '';
            let foundCountryCode = '';
            let foundPostalCode = '';
            let latitude: number | undefined;
            let longitude: number | undefined;
            details.address_components?.forEach((component) => {
              if (component.types.includes('locality')) {
                foundCity = component.long_name;
              }
              if (component.types.includes('administrative_area_level_1')) {
                foundState = component.long_name;
              }
              if (component.types.includes('country')) {
                foundCountry = component.long_name;
                foundCountryCode = component.short_name;
              }
              if (component.types.includes('postal_code'))
                foundPostalCode = component.long_name;
            });
            latitude = details.geometry?.location?.lat;
            longitude = details.geometry?.location?.lng;

            setDeliveryInfo((previous) => ({
              ...previous,
              address: data.description,
              city: foundCity,
              state: foundState,
              country: foundCountry,
              countryCode: foundCountryCode,
              postalCode: foundPostalCode,
              latitude,
              longitude,
            }));
          }}
          placeholder="Enter delivery address"
          query={{
            key: googleMapsApiKey,
            language: 'en',
          }}
          styles={{
            container: { flex: 0 },
            description: { color: colors.text },
            listView: {
              backgroundColor: colors.textOnPrimary,
              borderColor: colors.border,
              borderRadius: 8,
              borderWidth: 1,
              elevation: 5,
              left: 0,
              marginTop: 4,
              position: 'absolute',
              right: 0,
              top: 50,
              zIndex: 1000,
            },
            row: { backgroundColor: 'transparent', padding: 12 },
            separator: { backgroundColor: colors.border },
          }}
          textInputProps={{
            onChangeText: (text) => {
              const selectedDescription = selectedDescriptionRef.current;
              const preserveSelection =
                selectedDescription !== null && text === selectedDescription;
              if (preserveSelection) {
                setDeliveryInfo((previous) => ({
                  ...previous,
                  address: text,
                }));
                return;
              }
              selectedDescriptionRef.current = null;
              setDeliveryInfo((previous) => ({
                ...clearGeocodedFields(previous),
                address: text,
              }));
            },
            placeholderTextColor: colors.textMuted,
            style: {
              backgroundColor: colors.background,
              borderColor: colors.border,
              borderRadius: 8,
              borderWidth: 1,
              color: colors.text,
              fontSize: 16,
              paddingHorizontal: 12,
              paddingVertical: 12,
            },
            value: deliveryInfo.address,
          }}
        />
      ) : (
        <>
          <TextInput
            onChangeText={(text) =>
              setDeliveryInfo((previous) => ({
                ...previous,
                address: text,
                latitude: undefined,
                longitude: undefined,
              }))
            }
            placeholder="Enter delivery address"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                borderWidth: 1,
                color: colors.text,
              },
            ]}
            value={deliveryInfo.address}
          />
          <View style={[styles.rowBetween, { gap: 12, marginTop: 8 }]}>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.label,
                  { color: colors.textSecondary, marginBottom: 4 },
                ]}
              >
                City
              </Text>
              <TextInput
                onChangeText={(text) =>
                  setDeliveryInfo((previous) => ({
                    ...previous,
                    city: text,
                  }))
                }
                placeholder="City"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    borderWidth: 1,
                    color: colors.text,
                  },
                ]}
                value={deliveryInfo.city}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.label,
                  { color: colors.textSecondary, marginBottom: 4 },
                ]}
              >
                State
              </Text>
              <TextInput
                onChangeText={(text) =>
                  setDeliveryInfo((previous) => ({
                    ...previous,
                    state: text,
                  }))
                }
                placeholder="State"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    borderWidth: 1,
                    color: colors.text,
                  },
                ]}
                value={deliveryInfo.state}
              />
            </View>
          </View>
          <Text style={[styles.listSubValue, { color: colors.warning }]}>
            Address suggestions are unavailable because Google Maps is not
            configured.
          </Text>
        </>
      )}
    </View>
  );
}
