/**
 * AddressAutocomplete Component - 2026 Best Practice Implementation
 * Uses the web API routes for Google Places autocomplete
 *
 * Features:
 * - Debounced address search
 * - Dropdown with suggestions
 * - Auto-fills city and state on selection
 * - Nigeria country bias
 */

import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, {
  BRAND,
  palette,
  RADIUS,
  SHADOWS,
  SPACING,
} from '@/constants/Colors';
import { resolveApiBaseUrl } from '@/lib/api-url';

// API base URL - follows same pattern as orders.ts for consistency
const API_BASE_URL = resolveApiBaseUrl(
  process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl
);

interface PlacePrediction {
  placeId: string;
  mainText: string;
  secondaryText: string;
  description: string;
}

export interface PlaceDetails {
  streetNumber: string;
  route: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  formattedAddress: string;
}

interface AddressAutocompleteProps
  extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value?: string;
  onChangeText?: (value: string) => void;
  onSelect?: (place: PlaceDetails) => void;
  containerStyle?: ViewStyle;
  error?: string;
  label?: string;
  country?: string;
  /** Parent ScrollView ref — when supplied, scrolls to keep the dropdown above the keyboard */
  scrollRef?: React.RefObject<ScrollView | null>;
  /** Current scroll offset of the parent ScrollView (update via onScroll) */
  scrollOffsetRef?: React.RefObject<number>;
}

// Generate session token for Places API billing optimization
function generateSessionToken(): string {
  return Crypto.randomUUID();
}

// Simple in-memory cache for address predictions with max size limit
// BUG-5-009: Improve network resilience and performance
const PREDICTION_CACHE_MAX_SIZE = 50;
const predictionCache = new Map<string, PlacePrediction[]>();

function setCacheEntry(key: string, value: PlacePrediction[]): void {
  // Evict oldest entries if cache exceeds max size
  if (predictionCache.size >= PREDICTION_CACHE_MAX_SIZE) {
    const firstKey = predictionCache.keys().next().value;
    if (firstKey !== undefined) {
      predictionCache.delete(firstKey);
    }
  }
  predictionCache.set(key, value);
}

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
      predictionCache.clear();
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
      setPredictions([]);
      return;
    }

    // Check cache first
    if (predictionCache.has(input)) {
      setPredictions(predictionCache.get(input)!);
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        input,
        sessionToken,
        ...(country && { country }),
      });

      const response = await fetch(
        `${API_BASE_URL}/api/places/autocomplete?${params}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[Autocomplete] HTTP ${response.status}: ${errorText}`);
        if (response.status === 403) {
          throw new Error('Google Places API requires billing to be enabled.');
        }
        throw new Error('Failed to fetch predictions');
      }

      const data = await response.json();
      const results = data.predictions || [];
      setPredictions(results);
      setCacheEntry(input, results);
    } catch (error) {
      console.error('Error fetching predictions:', error);
      // Show specific error messages to the user via the console or UI
      setPredictions([]);
    } finally {
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
    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        placeId: prediction.placeId,
        sessionToken,
      });

      const response = await fetch(
        `${API_BASE_URL}/api/places/details?${params}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[PlaceDetails] HTTP ${response.status}: ${errorText}`);
        throw new Error('Failed to fetch place details');
      }

      const data = await response.json();
      // API returns { details: { city, state, ... } }
      const details = data.details;

      if (details && onSelect) {
        onSelect({
          streetNumber: details.streetNumber || '',
          route: details.route || '',
          city: details.city || '',
          state: details.state || '',
          zip: details.postalCode || '',
          country: details.country || '',
          formattedAddress: details.formattedAddress || prediction.description,
        });
      }

      // Refresh session token after selection
      setSessionToken(generateSessionToken());
    } catch (error) {
      console.error('Error fetching place details:', error);
    } finally {
      setIsLoading(false);
      setPredictions([]);
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

      {/* Predictions Dropdown — inline absolute, no Modal so keyboard stays open */}
      {isOpen && predictions.length > 0 && (
        <View
          style={[
            styles.dropdown,
            {
              backgroundColor: colors.card,
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border,
            },
          ]}
          accessibilityLabel="Address suggestions"
          accessibilityRole="list"
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            {predictions.map((item) => (
              <Pressable
                key={item.placeId}
                style={({ pressed }: { pressed: boolean }) => [
                  styles.predictionItem,
                  { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : colors.border },
                  pressed && {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.04)'
                      : colors.muted,
                  },
                ]}
                onPress={() => handlePredictionSelect(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.mainText}, ${item.secondaryText}`}
              >
                <View style={styles.predictionRow}>
                  <View style={[styles.predictionPinRail, { backgroundColor: isDark ? 'rgba(217, 59, 48, 0.14)' : `${BRAND.primary}12` }]}>
                    <Ionicons
                      name="location"
                      size={18}
                      color={BRAND.primary}
                      style={styles.predictionPin}
                    />
                  </View>
                  <View style={styles.predictionText}>
                    <Text
                      style={[styles.predictionMain, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {item.mainText}
                    </Text>
                    <Text
                      style={[styles.predictionSecondary, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {item.secondaryText}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
            <View
              style={[
                styles.footer,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.muted },
              ]}
            >
              <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                Powered by{' '}
              </Text>
              <Text style={[styles.footerText, { color: '#4285F4' }]}>G</Text>
              <Text style={[styles.footerText, { color: '#EA4335' }]}>o</Text>
              <Text style={[styles.footerText, { color: '#FBBC05' }]}>o</Text>
              <Text style={[styles.footerText, { color: '#4285F4' }]}>g</Text>
              <Text style={[styles.footerText, { color: '#34A853' }]}>l</Text>
              <Text style={[styles.footerText, { color: '#EA4335' }]}>e</Text>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    overflow: 'visible',
    zIndex: 1000,
    elevation: 1000,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: SPACING.xs,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    overflow: 'visible',
    minHeight: 52,
    borderColor: 'transparent',
  },
  containerError: {
    borderColor: palette.red[500],
  },
  icon: {
    paddingLeft: SPACING.md,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
    paddingHorizontal: SPACING.sm,
  },
  loader: {
    paddingRight: SPACING.md,
  },
  clearButton: {
    paddingRight: SPACING.md,
    paddingVertical: 8,
  },
  error: {
    fontSize: 12,
    marginTop: 4,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.xl,
    ...SHADOWS.md,
    overflow: 'hidden',
    marginTop: 4,
    maxHeight: 280,
    zIndex: 9999,
    elevation: 9999,
  },
  predictionItem: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  predictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  predictionPinRail: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  predictionPin: {
    textAlign: 'center',
    marginLeft: 1, // Visual center tweak for Ionicons location
  },
  predictionText: {
    flex: 1,
    flexShrink: 1,
  },
  predictionMain: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  predictionSecondary: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderBottomLeftRadius: RADIUS.xl,
    borderBottomRightRadius: RADIUS.xl,
    marginTop: 4,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
