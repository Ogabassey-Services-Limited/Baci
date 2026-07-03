import Ionicons from '@react-native-vector-icons/ionicons';
import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import type { CountryCode } from 'react-native-country-picker-modal';
import type { ThemeColors } from '@/constants/theme';
import { customerCreateStyles as customerStyles } from './NewOrderCustomerCreateView.styles';
import {
  type AddressSuggestion,
  buildGoogleAutocompleteUrl,
  type GoogleAutocompleteResponse,
  toAddressSuggestions,
} from './new-customer-address-autocomplete';
import type { NewCustomerDraft } from './new-order.types';

interface NewCustomerAddressInputProps {
  address: string;
  colors: ThemeColors;
  googleMapsApiKey: string | undefined;
  onAddressBlur?: () => void;
  onAddressFocus?: () => void;
  selectedCountryCode: CountryCode;
  setNewCustomer: Dispatch<SetStateAction<NewCustomerDraft>>;
}

export function NewCustomerAddressInput({
  address,
  colors,
  googleMapsApiKey,
  onAddressBlur,
  onAddressFocus,
  selectedCountryCode,
  setNewCustomer,
}: NewCustomerAddressInputProps) {
  const hasGoogleMapsApiKey = Boolean(googleMapsApiKey);
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSequenceRef = useRef(0);

  useEffect(() => {
    if (!(hasGoogleMapsApiKey && googleMapsApiKey) || !isFocused) {
      requestSequenceRef.current += 1;
      setSuggestions([]);
      return;
    }

    const trimmedAddress = address.trim();
    if (trimmedAddress.length < 2) {
      requestSequenceRef.current += 1;
      setSuggestions([]);
      return;
    }

    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    const abortController = new AbortController();

    const timeout = setTimeout(() => {
      const autocompleteUrl = buildGoogleAutocompleteUrl({
        googleMapsApiKey,
        input: trimmedAddress,
        selectedCountryCode,
      });

      fetch(autocompleteUrl, { signal: abortController.signal })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Google Places returned ${response.status}`);
          }
          return (await response.json()) as GoogleAutocompleteResponse;
        })
        .then((data) => {
          if (requestSequenceRef.current !== requestSequence) {
            return;
          }

          const nextSuggestions = toAddressSuggestions(data);
          setSuggestions(nextSuggestions);
        })
        .catch(() => {
          if (requestSequenceRef.current === requestSequence) {
            setSuggestions([]);
          }
        });
    }, 300);

    return () => {
      clearTimeout(timeout);
      abortController.abort();
      requestSequenceRef.current += 1;
    };
  }, [
    address,
    googleMapsApiKey,
    hasGoogleMapsApiKey,
    isFocused,
    selectedCountryCode,
  ]);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) {
        clearTimeout(blurTimerRef.current);
      }
    };
  }, []);

  const handleAddressChange = (text: string) => {
    setNewCustomer((previous) => ({ ...previous, address: text }));
  };

  const handleAddressFocus = () => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    setIsFocused(true);
    onAddressFocus?.();
  };

  const handleAddressBlur = () => {
    blurTimerRef.current = setTimeout(() => {
      requestSequenceRef.current += 1;
      setIsFocused(false);
      setSuggestions([]);
      onAddressBlur?.();
    }, 150);
  };

  const handleSuggestionPress = (suggestion: AddressSuggestion) => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    requestSequenceRef.current += 1;
    setSuggestions([]);
    setIsFocused(false);
    Keyboard.dismiss();
    setNewCustomer((previous) => ({
      ...previous,
      address: suggestion.description,
    }));
    onAddressBlur?.();
  };

  return (
    <View style={[customerStyles.section, { zIndex: 10 }]}>
      <View style={customerStyles.sectionHeader}>
        <View
          style={[
            customerStyles.sectionIcon,
            { backgroundColor: colors.errorLight },
          ]}
        >
          <Ionicons color={colors.error} name="location-outline" size={17} />
        </View>
        <Text style={[customerStyles.sectionTitle, { color: colors.text }]}>
          Address
        </Text>
      </View>
      {hasGoogleMapsApiKey ? (
        <View>
          <Ionicons
            color={colors.error}
            name="map-outline"
            size={18}
            style={customerStyles.addressIcon}
          />
          <TextInput
            accessibilityLabel="Customer address"
            onBlur={handleAddressBlur}
            onChangeText={handleAddressChange}
            onFocus={handleAddressFocus}
            placeholder="Search Address"
            placeholderTextColor={colors.textMuted}
            style={[
              customerStyles.fieldInput,
              {
                backgroundColor: colors.inputBg,
                borderColor: colors.border,
                borderRadius: 12,
                borderWidth: 1,
                color: colors.text,
                fontSize: 16,
                minHeight: 54,
                paddingLeft: 44,
                paddingRight: 16,
              },
            ]}
            value={address}
          />
          {isFocused && suggestions.length > 0 ? (
            <View
              accessibilityLabel="Address suggestions"
              accessibilityRole="list"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: 12,
                borderWidth: 1,
                marginTop: 8,
                overflow: 'hidden',
              }}
            >
              {suggestions.map((suggestion) => (
                <Pressable
                  accessibilityLabel={`Use address ${suggestion.description}`}
                  accessibilityRole="button"
                  key={suggestion.placeId}
                  onPress={() => handleSuggestionPress(suggestion)}
                  style={({ pressed }) => [
                    {
                      borderBottomColor: colors.border,
                      borderBottomWidth: 1,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                    },
                    pressed && { backgroundColor: colors.backgroundLight },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={{ color: colors.text, fontWeight: '600' }}
                  >
                    {suggestion.mainText}
                  </Text>
                  {suggestion.secondaryText ? (
                    <Text
                      numberOfLines={1}
                      style={{ color: colors.textSecondary, marginTop: 2 }}
                    >
                      {suggestion.secondaryText}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
              <View
                style={{
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  paddingVertical: 10,
                }}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                  Powered by Google
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      ) : (
        <View
          style={[
            customerStyles.field,
            { backgroundColor: colors.inputBg, borderColor: colors.border },
          ]}
        >
          <Ionicons color={colors.error} name="map-outline" size={18} />
          <TextInput
            accessibilityLabel="Customer address"
            onChangeText={handleAddressChange}
            placeholder="Enter address"
            placeholderTextColor={colors.textMuted}
            style={[customerStyles.fieldInput, { color: colors.text }]}
            value={address}
          />
        </View>
      )}
    </View>
  );
}
