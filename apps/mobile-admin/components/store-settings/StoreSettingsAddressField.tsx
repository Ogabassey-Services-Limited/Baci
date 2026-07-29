import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  type StyleProp,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import type { CountryCode } from 'react-native-country-picker-modal';
import {
  type AddressSuggestion,
  assertGoogleAutocompleteResponse,
  buildGoogleAutocompleteUrl,
  type GoogleAutocompleteResponse,
  toAddressSuggestions,
} from '@/components/orders/new-customer-address-autocomplete';
import type { ThemeColors } from '@/constants/theme';
import { storeSettingsDetailsStyles as styles } from './StoreSettingsDetailsCard.styles';

interface StoreSettingsAddressFieldProps {
  address: string;
  colors: ThemeColors;
  countryCode: CountryCode;
  googleMapsApiKey: string | undefined;
  onAddressChange: (text: string) => void;
  shadowStyle: StyleProp<ViewStyle>;
}

export function StoreSettingsAddressField({
  address,
  colors,
  countryCode,
  googleMapsApiKey,
  onAddressChange,
  shadowStyle,
}: StoreSettingsAddressFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSequenceRef = useRef(0);

  useEffect(() => {
    if (!(googleMapsApiKey && isFocused) || address.trim().length < 2) {
      requestSequenceRef.current += 1;
      setSuggestions([]);
      return;
    }

    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      const url = buildGoogleAutocompleteUrl({
        googleMapsApiKey,
        input: address.trim(),
        selectedCountryCode: countryCode,
      });

      fetch(url, { signal: abortController.signal })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Google Places returned ${response.status}`);
          }
          const data = (await response.json()) as GoogleAutocompleteResponse;
          assertGoogleAutocompleteResponse(data);
          return data;
        })
        .then((data) => {
          if (requestSequenceRef.current === requestSequence) {
            setSuggestions(toAddressSuggestions(data));
          }
        })
        .catch((error: unknown) => {
          if (requestSequenceRef.current !== requestSequence) {
            return;
          }
          if (
            typeof __DEV__ !== 'undefined' &&
            __DEV__ &&
            !(error instanceof Error && error.name === 'AbortError')
          ) {
            console.warn('[StoreSettingsAddressField] Places lookup failed', {
              error,
            });
          }
          setSuggestions([]);
        });
    }, 300);

    return () => {
      clearTimeout(timeout);
      abortController.abort();
      requestSequenceRef.current += 1;
    };
  }, [address, countryCode, googleMapsApiKey, isFocused]);

  useEffect(
    () => () => {
      if (blurTimerRef.current) {
        clearTimeout(blurTimerRef.current);
      }
    },
    []
  );

  const handleBlur = () => {
    blurTimerRef.current = setTimeout(() => {
      requestSequenceRef.current += 1;
      setIsFocused(false);
      setSuggestions([]);
    }, 150);
  };

  const handleFocus = () => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    setIsFocused(true);
  };

  const handleSuggestionPress = (suggestion: AddressSuggestion) => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    requestSequenceRef.current += 1;
    setIsFocused(false);
    setSuggestions([]);
    Keyboard.dismiss();
    onAddressChange(suggestion.description);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card }, shadowStyle]}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Business Address
      </Text>
      <TextInput
        accessibilityLabel="Business Address"
        multiline={!googleMapsApiKey}
        numberOfLines={googleMapsApiKey ? 1 : 3}
        onBlur={handleBlur}
        onChangeText={onAddressChange}
        onFocus={handleFocus}
        placeholder={
          googleMapsApiKey
            ? 'Search business address'
            : 'Enter business address'
        }
        placeholderTextColor={colors.textMuted}
        style={[
          styles.addressInput,
          !googleMapsApiKey && styles.multilineInput,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        textAlignVertical={googleMapsApiKey ? 'center' : 'top'}
        value={address}
      />
      {isFocused && suggestions.length > 0 ? (
        <View
          accessibilityLabel="Address suggestions"
          accessibilityRole="list"
          style={[
            styles.addressSuggestions,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {suggestions.map((suggestion, index) => (
            <Pressable
              accessibilityLabel={`Use address ${suggestion.description}`}
              accessibilityRole="button"
              key={suggestion.placeId}
              onPress={() => handleSuggestionPress(suggestion)}
              style={({ pressed }) => [
                styles.addressSuggestion,
                index < suggestions.length - 1 && {
                  borderBottomColor: colors.border,
                  borderBottomWidth: 1,
                },
                pressed && { backgroundColor: colors.backgroundLight },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.addressMainText, { color: colors.text }]}
              >
                {suggestion.mainText}
              </Text>
              {suggestion.secondaryText ? (
                <Text
                  numberOfLines={1}
                  style={[
                    styles.addressSecondaryText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {suggestion.secondaryText}
                </Text>
              ) : null}
            </Pressable>
          ))}
          <Text
            style={[styles.googleAttribution, { color: colors.textSecondary }]}
          >
            Powered by Google
          </Text>
        </View>
      ) : null}
    </View>
  );
}
