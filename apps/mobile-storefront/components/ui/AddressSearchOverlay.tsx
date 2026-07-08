import Ionicons from '@react-native-vector-icons/ionicons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import type Colors from '@/constants/Colors';
import { BRAND } from '@/constants/Colors';
import { fetchAddressPredictions } from './AddressAutocomplete.api';
import { addressAutocompleteStyles as styles } from './AddressAutocomplete.styles';
import type { PlacePrediction } from './AddressAutocomplete.types';
import { AddressPredictionRow } from './AddressPredictionRow';
import AppKeyboardContainer from './AppKeyboardContainer';

type ColorsScheme = (typeof Colors)['light'];

const MIN_QUERY_LENGTH = 2;
const PREDICTIONS_DEBOUNCE_MS = 300;

interface AddressSearchOverlayProps {
  colors: ColorsScheme;
  country: string;
  initialValue: string;
  isDark: boolean;
  onClose: () => void;
  onSelectPrediction: (prediction: PlacePrediction) => void;
  onUseTypedAddress: (address: string) => void;
  sessionToken: string;
  visible: boolean;
}

/**
 * Full-screen address search sheet. The suggestions list lives in its own
 * Modal — outside the checkout form's ScrollView — so it owns its gestures
 * and keyboard: no parent scroll stealing the drag on Android, no
 * keyboard-dismiss blur race, no z-index fights. Mirrors the City/State
 * pickers in the same checkout card.
 */
export function AddressSearchOverlay({
  colors,
  country,
  initialValue,
  isDark,
  onClose,
  onSelectPrediction,
  onUseTypedAddress,
  sessionToken,
  visible,
}: AddressSearchOverlayProps) {
  const [query, setQuery] = useState(initialValue);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const searchInputRef = useRef<TextInput>(null);

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

  // Re-seed the search box from the form value each time the sheet opens
  // (adjust-state-during-render, per react.dev's prop-change pattern).
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setQuery(initialValue);
      setPredictions([]);
    }
  }

  const fetchPredictions = async (input: string) => {
    if (input.trim().length < MIN_QUERY_LENGTH) {
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

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      fetchPredictions(text);
    }, PREDICTIONS_DEBOUNCE_MS);
  };

  const typedAddress = query.trim();
  const canUseTyped = typedAddress.length >= MIN_QUERY_LENGTH;

  const commitTypedAddress = () => {
    if (canUseTyped) {
      onUseTypedAddress(typedAddress);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      // Focus after the slide-in completes: auto-focusing during the Modal
      // animation makes the sheet land at the bottom and then get shoved up by
      // the keyboard mid-flight — two visible motions instead of one.
      onShow={() => searchInputRef.current?.focus()}
    >
      <AppKeyboardContainer style={styles.sheetOverlay}>
        <Pressable
          style={styles.sheetBackdrop}
          onPress={onClose}
          accessibilityLabel="Dismiss address search"
          accessibilityRole="button"
        />
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>
              Street Address
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close address search"
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View
            style={[
              styles.sheetSearchContainer,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.05)'
                  : colors.muted,
              },
            ]}
          >
            <Ionicons
              name="location-outline"
              size={18}
              color={colors.textSecondary}
            />
            <TextInput
              ref={searchInputRef}
              style={[styles.sheetSearchInput, { color: colors.text }]}
              value={query}
              onChangeText={handleQueryChange}
              placeholder="Start typing your address..."
              placeholderTextColor={colors.placeholder}
              autoComplete="street-address"
              textContentType="fullStreetAddress"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={commitTypedAddress}
              accessibilityLabel="Street address"
              accessibilityHint="Start typing to see address suggestions"
            />
            {isLoading ? (
              <ActivityIndicator size="small" color={BRAND.primary} />
            ) : query.length > 0 ? (
              <Pressable
                onPress={() => handleQueryChange('')}
                hitSlop={8}
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

          {canUseTyped ? (
            <Pressable
              accessibilityLabel={`Use ${typedAddress} as address`}
              accessibilityRole="button"
              onPress={commitTypedAddress}
              style={[
                styles.useTypedRow,
                {
                  borderColor: isDark
                    ? 'rgba(245, 158, 11, 0.35)'
                    : 'rgba(245, 158, 11, 0.28)',
                },
              ]}
            >
              <View style={styles.useTypedContent}>
                <View style={styles.predictionText}>
                  <Text style={styles.useTypedLabel}>Use typed address</Text>
                  <Text
                    style={[styles.useTypedText, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {typedAddress}
                  </Text>
                </View>
                <Ionicons name="add-circle" size={20} color={BRAND.primary} />
              </View>
            </Pressable>
          ) : null}

          <FlatList
            data={predictions}
            keyExtractor={(item) => item.placeId}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <AddressPredictionRow
                colors={colors}
                isDark={isDark}
                onSelect={onSelectPrediction}
                prediction={item}
              />
            )}
            ListFooterComponent={
              predictions.length > 0 ? (
                <View
                  style={[
                    styles.footer,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.04)'
                        : colors.muted,
                    },
                  ]}
                >
                  <Text
                    style={[styles.footerText, { color: colors.textSecondary }]}
                  >
                    Powered by{' '}
                  </Text>
                  <Text style={[styles.footerText, { color: '#4285F4' }]}>
                    G
                  </Text>
                  <Text style={[styles.footerText, { color: '#EA4335' }]}>
                    o
                  </Text>
                  <Text style={[styles.footerText, { color: '#FBBC05' }]}>
                    o
                  </Text>
                  <Text style={[styles.footerText, { color: '#4285F4' }]}>
                    g
                  </Text>
                  <Text style={[styles.footerText, { color: '#34A853' }]}>
                    l
                  </Text>
                  <Text style={[styles.footerText, { color: '#EA4335' }]}>
                    e
                  </Text>
                </View>
              ) : null
            }
          />
        </View>
      </AppKeyboardContainer>
    </Modal>
  );
}
