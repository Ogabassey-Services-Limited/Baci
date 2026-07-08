import Ionicons from '@react-native-vector-icons/ionicons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import {
  clearPredictionCache,
  fetchAddressPredictions,
  fetchPlaceDetails,
  generateSessionToken,
} from './AddressAutocomplete.api';
import { addressAutocompleteStyles as styles } from './AddressAutocomplete.styles';
import type {
  AddressAutocompleteProps,
  PlacePrediction,
} from './AddressAutocomplete.types';
import { useAddressSuggestionsPortal } from './address-suggestions-portal';
import { applyPlaceSelection } from './apply-place-selection';

export type { PlaceDetails } from './AddressAutocomplete.types';

const PREDICTIONS_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

/**
 * Inline address field: type directly in the form, suggestions drop down
 * beneath it. The list itself renders through AddressSuggestionsProvider's
 * screen-root layer (never inside the form's ScrollView), so list taps don't
 * blur the input and no scroll gesture can steal or dismiss it — the old
 * grace-timer/scrim/z-index workarounds stay unnecessary.
 */
export function AddressAutocomplete({
  value = '',
  onChangeText,
  onSelect,
  containerStyle,
  error,
  label,
  country = 'ng',
  placeholder = 'Start typing your address...',
}: AddressAutocompleteProps) {
  const portal = useAddressSuggestionsPortal();
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [internalValue, setInternalValue] = useState(value);
  const [sessionToken, setSessionToken] = useState(generateSessionToken);
  const prevSessionTokenRef = useRef(sessionToken);
  useEffect(() => {
    if (prevSessionTokenRef.current !== sessionToken) {
      clearPredictionCache();
      prevSessionTokenRef.current = sessionToken;
    }
  }, [sessionToken]);

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = (colorScheme ?? 'light') === 'dark';

  const isMountedRef = useRef(true);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<View>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    };
  }, []);

  // Adjust state inline during render when the controlled value prop changes
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setInternalValue(value);
  }

  const handlePredictionSelect = async (prediction: PlacePrediction) => {
    Keyboard.dismiss();
    setInternalValue(prediction.mainText);
    onChangeText?.(prediction.mainText);
    setPredictions([]);
    if (isMountedRef.current) {
      setIsLoading(true);
    }

    const details = await fetchPlaceDetails({ prediction, sessionToken });
    applyPlaceSelection({
      details,
      isMountedRef,
      onSelect,
      setIsLoading,
      setPredictions,
      setSessionToken,
    });
  };

  // Publish the dropdown into the screen-root portal whenever it should be
  // visible; anchor at the field's window position. Re-measured per change so
  // keyboard-driven layout shifts keep the list attached.
  const shouldShowSuggestions = isFocused && predictions.length > 0;
  useEffect(() => {
    if (!shouldShowSuggestions) {
      portal.hide();
      return;
    }
    wrapperRef.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) {
        return;
      }
      portal.show({
        anchor: { height, width, x, y },
        colors,
        isDark,
        onSelect: handlePredictionSelect,
        predictions,
      });
    });
    return () => portal.hide();
    // handlePredictionSelect is recreated per render; the effect keys off the
    // data that changes what the portal displays.
    // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  }, [
    shouldShowSuggestions,
    predictions,
    colors,
    isDark,
    portal,
    handlePredictionSelect,
  ]);

  // keyboardDismissMode="on-drag" on the form hides the keyboard when the
  // user scrolls away — treat that as leaving the field.
  useEffect(() => {
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      inputRef.current?.blur();
    });
    return () => hideSub.remove();
  }, []);

  const fetchPredictions = async (input: string) => {
    if (input.length < MIN_QUERY_LENGTH) {
      if (isMountedRef.current) {
        setPredictions([]);
      }
      return;
    }

    if (isMountedRef.current) {
      setIsLoading(true);
    }
    const results = await fetchAddressPredictions({
      country,
      input,
      sessionToken,
    });
    if (isMountedRef.current) {
      setPredictions(results);
      setIsLoading(false);
    }
  };

  const handleInputChange = (text: string) => {
    setInternalValue(text);
    onChangeText?.(text);
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      fetchPredictions(text);
    }, PREDICTIONS_DEBOUNCE_MS);
  };

  const handleClear = () => {
    setInternalValue('');
    onChangeText?.('');
    setPredictions([]);
  };

  return (
    <View ref={wrapperRef} style={[styles.wrapper, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {label}
        </Text>
      )}

      <View
        style={[
          styles.container,
          {
            backgroundColor: isDark
              ? 'rgba(255, 255, 255, 0.05)'
              : colors.muted,
            borderColor: error
              ? colors.error
              : isFocused
                ? BRAND.primary
                : colors.border,
          },
        ]}
      >
        <Ionicons
          name="location-outline"
          size={18}
          color={colors.textSecondary}
          style={styles.icon}
        />

        <TextInput
          ref={inputRef}
          style={[styles.input, { color: colors.text }]}
          value={internalValue}
          onChangeText={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          autoComplete="street-address"
          textContentType="fullStreetAddress"
          accessibilityLabel="Street address"
          accessibilityHint="Start typing to see address suggestions"
          accessibilityRole="combobox"
          accessibilityState={{ expanded: shouldShowSuggestions }}
        />

        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={BRAND.primary}
            style={styles.loader}
          />
        ) : internalValue ? (
          <Pressable
            onPress={handleClear}
            style={({ pressed }) => [
              styles.clearButton,
              pressed && { opacity: 0.7 },
            ]}
            accessibilityLabel="Clear address"
            accessibilityRole="button"
          >
            <Ionicons
              name="close-circle"
              size={18}
              color={colors.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>

      {error && (
        <Text style={[styles.error, { color: colors.destructive }]}>
          {error}
        </Text>
      )}
    </View>
  );
}
