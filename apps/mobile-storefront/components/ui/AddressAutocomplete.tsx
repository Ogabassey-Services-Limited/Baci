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
import { AddressPredictionsDropdown } from './AddressPredictionsDropdown';
import { applyPlaceSelection } from './apply-place-selection';

export type { PlaceDetails } from './AddressAutocomplete.types';

// How long after the user last touched the predictions dropdown a blur is
// still attributed to that interaction (and must not close the dropdown).
// Android can steal the gesture from the inner list (firing touchCancel)
// before the keyboard-dismiss blur lands, so a live boolean latch loses the
// race — recency is what both platforms agree on.
const DROPDOWN_INTERACTION_GRACE_MS = 750;

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
  ...props
}: AddressAutocompleteProps) {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [sessionToken, setSessionToken] = useState(generateSessionToken);
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
  // Epoch ms of the user's last touch on the predictions dropdown. A blur
  // arriving within DROPDOWN_INTERACTION_GRACE_MS of it is attributed to that
  // touch (keyboard-dismiss-on-drag) and must not close the dropdown.
  const lastDropdownInteractionAtRef = useRef(0);

  // Backstop: whenever the dropdown closes, clear the recency marker so a
  // stale touch can't suppress a later genuine blur-close.
  useEffect(() => {
    if (!isOpen) {
      lastDropdownInteractionAtRef.current = 0;
    }
  }, [isOpen]);

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

  // Adjust state inline during render when the controlled value prop changes
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setInternalValue(value);
  }

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
    applyPlaceSelection({
      details,
      isMountedRef,
      onSelect,
      setIsLoading,
      setPredictions,
      setSessionToken,
    });
  };

  const handleClear = () => {
    setInternalValue('');
    onChangeText?.('');
    setPredictions([]);
    setIsOpen(false);
  };

  const closeDropdown = () => {
    lastDropdownInteractionAtRef.current = 0;
    setIsOpen(false);
    Keyboard.dismiss();
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
            // Focus can only return after a blur, so any prior dropdown drag is
            // over — clear the recency marker before the next blur.
            lastDropdownInteractionAtRef.current = 0;
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
            // Don't close the dropdown when the blur was caused by touching the
            // dropdown itself (keyboard-dismiss-on-drag blurs this input) —
            // only when focus genuinely left the field. Recency, not a live
            // flag: Android can cancel the dropdown touch before this blur
            // lands. The scrim is the dismissal path while the list stays open.
            const sinceDropdownTouch =
              Date.now() - lastDropdownInteractionAtRef.current;
            if (sinceDropdownTouch > DROPDOWN_INTERACTION_GRACE_MS) {
              if (blurCloseTimerRef.current) {
                clearTimeout(blurCloseTimerRef.current);
              }
              blurCloseTimerRef.current = setTimeout(() => {
                setIsOpen(false);
                blurCloseTimerRef.current = null;
              }, 150);
            }
            onBlur?.(event);
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          autoComplete="street-address"
          textContentType="fullStreetAddress"
          accessibilityLabel="Street address"
          accessibilityHint="Start typing to see address suggestions"
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

      {isOpen && predictions.length > 0 && (
        <>
          {/* Tap-outside-to-dismiss: after keyboard-dismiss-on-drag blurs the
              input, the dropdown can no longer close via blur, so a scrim
              behind it catches taps on the obscured form and closes it. */}
          <Pressable
            accessibilityLabel="Close address suggestions"
            accessibilityRole="button"
            onPress={closeDropdown}
            style={styles.dropdownScrim}
          />
          <AddressPredictionsDropdown
            colors={colors}
            isDark={isDark}
            onInteractEnd={() => {
              lastDropdownInteractionAtRef.current = Date.now();
            }}
            onInteractStart={() => {
              lastDropdownInteractionAtRef.current = Date.now();
            }}
            onSelectPrediction={handlePredictionSelect}
            predictions={predictions}
          />
        </>
      )}
    </View>
  );
}
