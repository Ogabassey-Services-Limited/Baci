import Ionicons from "@react-native-vector-icons/ionicons";
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
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
import { AddressPredictionsDropdown } from './AddressPredictionsDropdown';

export type { PlaceDetails } from './AddressAutocomplete.types';

export function AddressAutocomplete({
  value = '',
  onChangeText,
  onSelect,
  containerStyle,
  error,
  label,
  country = 'ng',
  placeholder = 'Start typing your address...',
  onBlur,
  onFocus,
  scrollRef,
  scrollOffsetRef,
  ...props
}: AddressAutocompleteProps) {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [sessionToken, setSessionToken] = useState<string>(() =>
    generateSessionToken()
  );
  // L6 fix: Track previous session token and clear prediction cache when it changes
  const prevSessionTokenRef = useRef(sessionToken);
  useEffect(() => {
    if (prevSessionTokenRef.current !== sessionToken) {
      clearPredictionCache();
      prevSessionTokenRef.current = sessionToken;
    }
  }, [sessionToken]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [internalValue, setInternalValue] = useState(value);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = (colorScheme ?? 'light') === 'dark';
  const [isFocused, setIsFocused] = useState(false);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const blurCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<View>(null);
  const keyboardHeightRef = useRef(0);

  // M16 fix: Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      if (blurCloseTimerRef.current) {
        clearTimeout(blurCloseTimerRef.current);
        blurCloseTimerRef.current = null;
      }
    };
  }, []);

  // Track keyboard height and scroll into view when dropdown opens
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      keyboardHeightRef.current = e.endCoordinates.height;
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      keyboardHeightRef.current = 0;
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // When dropdown opens, scroll parent so the dropdown clears the keyboard
  useEffect(() => {
    if (!isOpen || predictions.length === 0 || !scrollRef?.current) return;
    wrapperRef.current?.measureInWindow((_x, screenY, _w, inputHeight) => {
      if (screenY <= 0 || inputHeight <= 0) return;
      const DROPDOWN_HEIGHT = 280;
      const PADDING = 16;
      const screenHeight = Dimensions.get('window').height;
      const kbHeight = keyboardHeightRef.current || Keyboard.metrics()?.height || 0;
      const keyboardTop = screenHeight - kbHeight;
      const dropdownBottom = screenY + inputHeight + DROPDOWN_HEIGHT + PADDING;
      if (dropdownBottom > keyboardTop) {
        const overflow = dropdownBottom - keyboardTop;
        const currentOffset = scrollOffsetRef?.current ?? 0;
        scrollRef.current?.scrollTo({
          y: currentOffset + overflow + PADDING,
          animated: true,
        });
      }
    });
  }, [isOpen, predictions.length, scrollRef, scrollOffsetRef]);

  // Sync with external value
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const fetchPredictions = async (input: string) => {
    if (input.length < 2) {
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
    setIsOpen(text.trim().length >= 2);

    // Debounce API call
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      fetchPredictions(text);
    }, 300);
  };

  const handlePredictionSelect = async (prediction: PlacePrediction) => {
    Keyboard.dismiss();
    setInternalValue(prediction.mainText);
    onChangeText?.(prediction.mainText);
    setIsOpen(false);
    if (isMountedRef.current) {
      setIsLoading(true);
    }

    const details = await fetchPlaceDetails({ prediction, sessionToken });
    try {
      if (details && onSelect) {
        onSelect(details);
      }
      if (isMountedRef.current) {
        // Refresh session token after selection
        setSessionToken(generateSessionToken());
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setPredictions([]);
      }
    }
  };

  const handleClear = () => {
    setInternalValue('');
    onChangeText?.('');
    setPredictions([]);
    setIsOpen(false);
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
          style={[styles.input, { color: colors.text }]}
          value={internalValue}
          onChangeText={handleInputChange}
          onFocus={(event) => {
            if (blurCloseTimerRef.current) {
              clearTimeout(blurCloseTimerRef.current);
              blurCloseTimerRef.current = null;
            }
            setIsFocused(true);
            if (internalValue.trim().length >= 2) {
              setIsOpen(true);
            }
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            if (blurCloseTimerRef.current) {
              clearTimeout(blurCloseTimerRef.current);
            }
            // Delay so prediction-item taps can fire before the dropdown closes
            blurCloseTimerRef.current = setTimeout(() => {
              setIsOpen(false);
              blurCloseTimerRef.current = null;
            }, 150);
            onBlur?.(event);
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          autoComplete="street-address"
          textContentType="fullStreetAddress"
          accessibilityLabel="Street address"
          accessibilityHint="Start typing to see address suggestions"
          // BUG-5-021: Improved accessibility for screen readers
          accessibilityRole="combobox"
          accessibilityState={{ expanded: isOpen }}
          {...props}
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
            style={styles.clearButton}
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

      {/* Error Message */}
      {error && (
        <Text style={[styles.error, { color: colors.destructive }]}>
          {error}
        </Text>
      )}

      {isOpen && predictions.length > 0 && (
        <AddressPredictionsDropdown
          colors={colors}
          isDark={isDark}
          onSelectPrediction={handlePredictionSelect}
          predictions={predictions}
        />
      )}
    </View>
  );
}
