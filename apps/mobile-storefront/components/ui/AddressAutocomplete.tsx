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
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import { palette } from '@/constants/Colors';

// API base URL - follows same pattern as orders.ts for consistency
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  'https://ogabassey.usebaci.com';

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
}

// Generate session token for Places API billing optimization
function generateSessionToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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
  ...props
}: AddressAutocompleteProps) {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [sessionToken, setSessionToken] = useState<string>(() =>
    generateSessionToken()
  );
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [internalValue, setInternalValue] = useState(value);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Sync with external value
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const fetchPredictions = useCallback(
    async (input: string) => {
      if (input.length < 2) {
        setPredictions([]);
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
          throw new Error('Failed to fetch predictions');
        }

        const data = await response.json();
        setPredictions(data.predictions || []);
      } catch (error) {
        console.error('Error fetching predictions:', error);
        setPredictions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [sessionToken, country]
  );

  const handleInputChange = useCallback(
    (text: string) => {
      setInternalValue(text);
      onChangeText?.(text);
      setIsOpen(true);

      // Debounce API call
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        fetchPredictions(text);
      }, 300);
    },
    [onChangeText, fetchPredictions]
  );

  const handlePredictionSelect = useCallback(
    async (prediction: PlacePrediction) => {
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
            formattedAddress:
              details.formattedAddress || prediction.description,
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
    },
    [sessionToken, onChangeText, onSelect]
  );

  const handleClear = useCallback(() => {
    setInternalValue('');
    onChangeText?.('');
    setPredictions([]);
    setIsOpen(false);
  }, [onChangeText]);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={[styles.container, error && styles.containerError]}>
        <Ionicons
          name="location-outline"
          size={18}
          color={palette.gray[400]}
          style={styles.icon}
        />

        <TextInput
          style={styles.input}
          value={internalValue}
          onChangeText={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          placeholderTextColor={palette.gray[400]}
          autoComplete="street-address"
          textContentType="fullStreetAddress"
          {...props}
        />

        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={palette.red[600]}
            style={styles.loader}
          />
        ) : internalValue ? (
          <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
            <Ionicons name="close-circle" size={18} color={palette.gray[400]} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Error Message */}
      {error && <Text style={styles.error}>{error}</Text>}

      {/* Predictions Dropdown */}
      {isOpen && predictions.length > 0 && (
        <View style={styles.dropdown}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            {predictions.map((item) => (
              <TouchableOpacity
                key={item.placeId}
                style={styles.predictionRow}
                onPress={() => handlePredictionSelect(item)}
              >
                <View style={styles.predictionIcon}>
                  <Ionicons
                    name="location"
                    size={14}
                    color={palette.gray[500]}
                  />
                </View>
                <View style={styles.predictionText}>
                  <Text style={styles.predictionMain} numberOfLines={1}>
                    {item.mainText}
                  </Text>
                  <Text style={styles.predictionSecondary} numberOfLines={1}>
                    {item.secondaryText}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Powered by </Text>
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
    zIndex: 1000,
    elevation: 1000,
    overflow: 'visible',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: palette.gray[700],
    marginBottom: 6,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.gray[50],
    borderWidth: 1,
    borderColor: palette.gray[200],
    borderRadius: 12,
    overflow: 'visible',
  },
  containerError: {
    borderColor: palette.red[500],
  },
  icon: {
    paddingLeft: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: palette.gray[900],
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  loader: {
    paddingRight: 12,
  },
  clearButton: {
    paddingRight: 12,
    paddingVertical: 8,
  },
  error: {
    fontSize: 12,
    color: palette.red[500],
    marginTop: 4,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.gray[200],
    borderRadius: 12,
    marginTop: 8,
    maxHeight: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10000,
  },
  predictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.gray[100],
    gap: 10,
  },
  predictionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  predictionText: {
    flex: 1,
  },
  predictionMain: {
    fontSize: 14,
    fontWeight: '500',
    color: palette.gray[900],
  },
  predictionSecondary: {
    fontSize: 12,
    color: palette.gray[500],
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: palette.gray[50],
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  footerText: {
    fontSize: 11,
    color: palette.gray[400],
    fontWeight: '500',
  },
});
