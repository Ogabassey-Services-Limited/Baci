import Ionicons from '@react-native-vector-icons/ionicons';
import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Text, View } from 'react-native';
import type { CountryCode } from 'react-native-country-picker-modal';
import { SheetTextInput } from '@/components/ui/SheetTextInput';
import type { ThemeColors } from '@/constants/theme';
import { fetchGoogleAddressDetails } from './google-address-details';
import { NewCustomerAddressSuggestions } from './NewCustomerAddressSuggestions';
import { NewCustomerManualAddressFallback } from './NewCustomerManualAddressFallback';
import { customerCreateStyles as customerStyles } from './NewOrderCustomerCreateView.styles';
import {
  type AddressSuggestion,
  assertGoogleAutocompleteResponse,
  buildGoogleAutocompleteUrl,
  type GoogleAutocompleteResponse,
  toAddressSuggestions,
} from './new-customer-address-autocomplete';
import type { NewCustomerDraft } from './new-order.types';

interface NewCustomerAddressInputProps {
  address: string;
  city?: string;
  colors: ThemeColors;
  googleMapsApiKey: string | undefined;
  onAddressBlur?: () => void;
  onAddressDetailsPendingChange?: (pending: boolean) => void;
  onAddressFocus?: () => void;
  selectedCountryCode: CountryCode;
  setNewCustomer: Dispatch<SetStateAction<NewCustomerDraft>>;
  state?: string;
}

export function NewCustomerAddressInput({
  address,
  city = '',
  colors,
  googleMapsApiKey,
  onAddressBlur,
  onAddressDetailsPendingChange,
  onAddressFocus,
  selectedCountryCode,
  setNewCustomer,
  state = '',
}: NewCustomerAddressInputProps) {
  const hasGoogleMapsApiKey = Boolean(googleMapsApiKey);
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSequenceRef = useRef(0);
  const selectionSequenceRef = useRef(0);

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
          const data = (await response.json()) as GoogleAutocompleteResponse;
          assertGoogleAutocompleteResponse(data);
          return data;
        })
        .then((data) => {
          if (requestSequenceRef.current !== requestSequence) {
            return;
          }

          const nextSuggestions = toAddressSuggestions(data);
          setSuggestions(nextSuggestions);
        })
        .catch((error: unknown) => {
          if (requestSequenceRef.current === requestSequence) {
            if (
              typeof __DEV__ !== 'undefined' &&
              __DEV__ &&
              !(
                error instanceof Error &&
                error.name.toLowerCase() === 'aborterror'
              )
            ) {
              console.warn('[NewCustomerAddressInput] Places lookup failed', {
                error,
              });
            }
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
    selectionSequenceRef.current += 1;
    onAddressDetailsPendingChange?.(false);
    if (!hasGoogleMapsApiKey) {
      // Manual city/state entry — only clear coords so locality is not wiped.
      setNewCustomer((previous) => ({
        ...previous,
        address: text,
        latitude: undefined,
        longitude: undefined,
      }));
      return;
    }
    setNewCustomer((previous) => ({
      ...previous,
      address: text,
      city: '',
      state: '',
      country: '',
      countryCode: '',
      postalCode: '',
      latitude: undefined,
      longitude: undefined,
    }));
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
    const selectionSequence = selectionSequenceRef.current + 1;
    selectionSequenceRef.current = selectionSequence;
    setNewCustomer((previous) => ({
      ...previous,
      address: suggestion.description,
      city: '',
      state: '',
      country: '',
      countryCode: '',
      postalCode: '',
      latitude: undefined,
      longitude: undefined,
    }));
    if (googleMapsApiKey && suggestion.placeId) {
      onAddressDetailsPendingChange?.(true);
      fetchGoogleAddressDetails({
        googleMapsApiKey,
        placeId: suggestion.placeId,
      })
        .then((details) => {
          if (selectionSequenceRef.current !== selectionSequence) {
            return;
          }
          if (details) {
            setNewCustomer((previous) => ({ ...previous, ...details }));
          }
        })
        .catch(() => undefined)
        .finally(() => {
          if (selectionSequenceRef.current === selectionSequence) {
            onAddressDetailsPendingChange?.(false);
          }
        });
    } else {
      onAddressDetailsPendingChange?.(false);
    }
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
          <SheetTextInput
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
          {isFocused ? (
            <NewCustomerAddressSuggestions
              colors={colors}
              onSelect={handleSuggestionPress}
              suggestions={suggestions}
            />
          ) : null}
        </View>
      ) : (
        <NewCustomerManualAddressFallback
          address={address}
          city={city}
          colors={colors}
          onAddressChange={handleAddressChange}
          setNewCustomer={setNewCustomer}
          state={state}
        />
      )}
    </View>
  );
}
