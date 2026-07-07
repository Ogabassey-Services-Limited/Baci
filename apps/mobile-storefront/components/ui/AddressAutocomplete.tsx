import Ionicons from '@react-native-vector-icons/ionicons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import {
  clearPredictionCache,
  fetchPlaceDetails,
  generateSessionToken,
} from './AddressAutocomplete.api';
import { addressAutocompleteStyles as styles } from './AddressAutocomplete.styles';
import type {
  AddressAutocompleteProps,
  PlacePrediction,
} from './AddressAutocomplete.types';
import { AddressSearchOverlay } from './AddressSearchOverlay';
import { applyPlaceSelection } from './apply-place-selection';

export type { PlaceDetails } from './AddressAutocomplete.types';

/**
 * Address field for forms: a read-only trigger row that opens a full-screen
 * search sheet (AddressSearchOverlay). Suggestions never render inline inside
 * the host ScrollView — that legacy pattern fights Android gesture stealing,
 * keyboard-dismiss blur races, and out-of-bounds hit-testing (RN #54659).
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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handlePredictionSelect = async (prediction: PlacePrediction) => {
    setIsSearchOpen(false);
    onChangeText?.(prediction.mainText);
    if (isMountedRef.current) {
      setIsLoading(true);
    }

    const details = await fetchPlaceDetails({ prediction, sessionToken });
    applyPlaceSelection({
      details,
      isMountedRef,
      onSelect,
      setIsLoading,
      setSessionToken,
    });
  };

  const handleUseTypedAddress = (address: string) => {
    setIsSearchOpen(false);
    onChangeText?.(address);
  };

  const handleClear = () => {
    onChangeText?.('');
  };

  return (
    <View style={[styles.wrapper, containerStyle]}>
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
            borderColor: error ? colors.error : colors.border,
          },
        ]}
      >
        <Ionicons
          name="location-outline"
          size={18}
          color={colors.textSecondary}
          style={styles.icon}
        />

        <Pressable
          style={styles.input}
          onPress={() => setIsSearchOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Street address"
          accessibilityHint="Opens address search"
        >
          <Text
            style={[
              styles.triggerText,
              { color: value ? colors.text : colors.placeholder },
            ]}
            numberOfLines={1}
          >
            {value || placeholder}
          </Text>
        </Pressable>

        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={BRAND.primary}
            style={styles.loader}
          />
        ) : value ? (
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

      <AddressSearchOverlay
        colors={colors}
        country={country}
        initialValue={value}
        isDark={isDark}
        onClose={() => setIsSearchOpen(false)}
        onSelectPrediction={handlePredictionSelect}
        onUseTypedAddress={handleUseTypedAddress}
        sessionToken={sessionToken}
        visible={isSearchOpen}
      />
    </View>
  );
}
