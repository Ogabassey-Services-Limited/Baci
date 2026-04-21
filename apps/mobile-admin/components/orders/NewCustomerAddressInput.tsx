import type { Dispatch, SetStateAction } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import type { CountryCode } from 'react-native-country-picker-modal';
import type { ThemeColors } from '@/constants/theme';
import type { NewCustomerDraft } from './new-order.types';
import { styles } from './new-order.styles';

interface NewCustomerAddressInputProps {
  address: string;
  colors: ThemeColors;
  googleMapsApiKey: string | undefined;
  selectedCountryCode: CountryCode;
  setNewCustomer: Dispatch<SetStateAction<NewCustomerDraft>>;
}

export function NewCustomerAddressInput({
  address,
  colors,
  googleMapsApiKey,
  selectedCountryCode,
  setNewCustomer,
}: NewCustomerAddressInputProps) {
  const hasGoogleMapsApiKey = Boolean(googleMapsApiKey);

  return (
    <View style={{ gap: 8, zIndex: 10 }}>
      <Text style={{ color: colors.textSecondary }}>Address</Text>
      {hasGoogleMapsApiKey ? (
        <GooglePlacesAutocomplete
          debounce={300}
          enablePoweredByContainer
          fetchDetails={false}
          keepResultsAfterBlur
          keyboardShouldPersistTaps="handled"
          listViewDisplayed="auto"
          minLength={2}
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
          onPress={(data) => {
            setNewCustomer((previous) => ({
              ...previous,
              address: data.description,
            }));
          }}
          placeholder="Search Address"
          query={{
            components: selectedCountryCode
              ? `country:${selectedCountryCode.toLowerCase()}`
              : undefined,
            key: googleMapsApiKey,
            language: 'en',
          }}
          styles={{
            container: { flex: 0, zIndex: 999 },
            description: { color: colors.text },
            listView: {
              backgroundColor: colors.card,
              borderRadius: 12,
              elevation: 5,
              left: 0,
              marginTop: 4,
              position: 'absolute',
              right: 0,
              top: 54,
              zIndex: 1000,
            },
            poweredContainer: {
              backgroundColor: colors.card,
              borderBottomLeftRadius: 12,
              borderBottomRightRadius: 12,
            },
            row: {
              backgroundColor: colors.card,
              padding: 13,
            },
            textInput: {
              backgroundColor: colors.inputBg,
              borderRadius: 12,
              color: colors.text,
              fontSize: 16,
              height: 50,
              paddingHorizontal: 16,
            },
          }}
          textInputProps={{
            onChangeText: (text) =>
              setNewCustomer((previous) => ({ ...previous, address: text })),
            placeholderTextColor: colors.textMuted,
            value: address,
          }}
        />
      ) : (
        <TextInput
          onChangeText={(text) =>
            setNewCustomer((previous) => ({ ...previous, address: text }))
          }
          placeholder="Enter address"
          placeholderTextColor={colors.textMuted}
          style={[
            styles.sheetInput,
            { backgroundColor: colors.inputBg, color: colors.text },
          ]}
          value={address}
        />
      )}
    </View>
  );
}
