/**
 * CountryPickerModal – Searchable country picker in a page-sheet modal
 * Extracted from StoreSettingsScreen for modularity.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppPageSheet } from '@/components/ui/AppPageSheet';
import { COUNTRIES } from '@/constants/countries';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface CountryPickerModalProps {
  visible: boolean;
  selectedCountry: string;
  onSelect: (country: (typeof COUNTRIES)[0]) => void;
  onClose: () => void;
}

export function CountryPickerModal({
  visible,
  selectedCountry,
  onSelect,
  onClose,
}: CountryPickerModalProps) {
  const { colors } = useTheme();
  const [search, setSearch] = useState('');

  const filteredCountries = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppPageSheet
      closeLabel="Close country picker"
      contentContainerStyle={styles.pageSheetContent}
      onClose={onClose}
      scrollEnabled={false}
      title="Select Country"
      visible={visible}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.searchSection}>
          <View
            style={[
              styles.searchContainer,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name="search"
              size={20}
              color={colors.textSecondary}
              style={styles.searchIcon}
            />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search country..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              keyboardType="default"
              returnKeyType="search"
              accessibilityLabel="Search countries"
            />
            {search.length > 0 ? (
              <Pressable
                onPress={() => setSearch('')}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                accessibilityHint="Clears the country search input"
                style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                hitSlop={13}
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={colors.textMuted}
                />
              </Pressable>
            ) : null}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.countryList}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          {filteredCountries.map((item) => {
            const isSelected =
              selectedCountry === item.code || selectedCountry === item.name;
            return (
              <Pressable
                key={item.code}
                style={({ pressed }) => [
                  styles.countryItem,
                  {
                    backgroundColor: isSelected
                      ? colors.primaryLight
                      : colors.card,
                    borderColor: colors.border,
                  },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => onSelect(item)}
                accessibilityRole="button"
                accessibilityLabel={item.name}
                accessibilityState={{ selected: isSelected }}
              >
                <View>
                  <Text
                    style={[
                      styles.countryName,
                      {
                        color: colors.text,
                        fontWeight: isSelected ? 'bold' : 'normal',
                      },
                    ]}
                  >
                    {item.name}
                  </Text>
                  <Text
                    style={[
                      styles.currencyText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {item.currency} ({item.currencySymbol})
                  </Text>
                </View>
                {isSelected ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={colors.primary}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </AppPageSheet>
  );
}

const styles = StyleSheet.create({
  pageSheetContent: {
    padding: 0,
  },
  container: { flex: 1 },
  searchSection: {
    padding: SPACING.md,
    paddingBottom: 0,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    height: '100%',
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  countryList: {
    padding: SPACING.md,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
  },
  countryName: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  currencyText: { fontSize: TYPOGRAPHY.size.sm },
});
