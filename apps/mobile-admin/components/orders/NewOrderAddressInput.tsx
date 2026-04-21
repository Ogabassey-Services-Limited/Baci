import { Text, TextInput, View } from 'react-native';
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

export function NewOrderAddressInput({
  controller,
  googleMapsApiKey,
}: NewOrderAddressInputProps) {
  const { colors, deliveryInfo, setDeliveryInfo } = controller;
  const hasGoogleMapsApiKey = Boolean(googleMapsApiKey);

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
          onPress={(data, details = null) => {
            if (!details) {
              return;
            }

            let foundCity: string | null = null;
            let foundState: string | null = null;
            details.address_components?.forEach((component) => {
              if (component.types.includes('locality')) {
                foundCity = component.long_name;
              }
              if (component.types.includes('administrative_area_level_1')) {
                foundState = component.long_name;
              }
            });

            setDeliveryInfo((previous) => ({
              ...previous,
              address: data.description,
              ...(foundCity ? { city: foundCity } : {}),
              ...(foundState ? { state: foundState } : {}),
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
            onChangeText: (text) =>
              setDeliveryInfo((previous) => ({ ...previous, address: text })),
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
              setDeliveryInfo((previous) => ({ ...previous, address: text }))
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
          <Text style={[styles.listSubValue, { color: colors.warning }]}>
            Address suggestions are unavailable because Google Maps is not
            configured.
          </Text>
        </>
      )}
    </View>
  );
}
