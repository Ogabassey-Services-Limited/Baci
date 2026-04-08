/**
 * PhoneInput Component - 2026 Best Practice Implementation
 * Matches web app phone-input.tsx design with country flag selector
 *
 * Features:
 * - Country flag display (Nigeria default)
 * - Country code prefix (+234)
 * - Auto-strips leading zeros
 * - Country selector modal
 * - WCAG AA compliant
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, palette } from '@/constants/Colors';

// Country data type
interface Country {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  dialCode: string;
  flag: string; // Emoji flag
  maxLength?: number; // Max digits for national number
}

// Countries list — Nigeria first, then alphabetical.
// Aligned with web app's react-phone-number-input coverage.
// maxLength is the national number length (excluding country code)
const COUNTRIES: Country[] = [
  { code: 'NG', name: 'Nigeria', dialCode: '+234', flag: '🇳🇬', maxLength: 10 },
  { code: 'DZ', name: 'Algeria', dialCode: '+213', flag: '🇩🇿', maxLength: 9 },
  { code: 'AO', name: 'Angola', dialCode: '+244', flag: '🇦🇴', maxLength: 9 },
  { code: 'AR', name: 'Argentina', dialCode: '+54', flag: '🇦🇷', maxLength: 10 },
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺', maxLength: 9 },
  { code: 'AT', name: 'Austria', dialCode: '+43', flag: '🇦🇹', maxLength: 10 },
  { code: 'BH', name: 'Bahrain', dialCode: '+973', flag: '🇧🇭', maxLength: 8 },
  {
    code: 'BD',
    name: 'Bangladesh',
    dialCode: '+880',
    flag: '🇧🇩',
    maxLength: 10,
  },
  { code: 'BE', name: 'Belgium', dialCode: '+32', flag: '🇧🇪', maxLength: 9 },
  { code: 'BJ', name: 'Benin', dialCode: '+229', flag: '🇧🇯', maxLength: 8 },
  { code: 'BR', name: 'Brazil', dialCode: '+55', flag: '🇧🇷', maxLength: 11 },
  {
    code: 'BF',
    name: 'Burkina Faso',
    dialCode: '+226',
    flag: '🇧🇫',
    maxLength: 8,
  },
  { code: 'CM', name: 'Cameroon', dialCode: '+237', flag: '🇨🇲', maxLength: 9 },
  { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦', maxLength: 10 },
  { code: 'TD', name: 'Chad', dialCode: '+235', flag: '🇹🇩', maxLength: 8 },
  { code: 'CN', name: 'China', dialCode: '+86', flag: '🇨🇳', maxLength: 11 },
  {
    code: 'CD',
    name: 'Congo (DRC)',
    dialCode: '+243',
    flag: '🇨🇩',
    maxLength: 9,
  },
  {
    code: 'CI',
    name: "Cote d'Ivoire",
    dialCode: '+225',
    flag: '🇨🇮',
    maxLength: 10,
  },
  { code: 'EG', name: 'Egypt', dialCode: '+20', flag: '🇪🇬', maxLength: 10 },
  { code: 'ET', name: 'Ethiopia', dialCode: '+251', flag: '🇪🇹', maxLength: 9 },
  { code: 'FI', name: 'Finland', dialCode: '+358', flag: '🇫🇮', maxLength: 10 },
  { code: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷', maxLength: 9 },
  { code: 'GA', name: 'Gabon', dialCode: '+241', flag: '🇬🇦', maxLength: 8 },
  { code: 'GM', name: 'Gambia', dialCode: '+220', flag: '🇬🇲', maxLength: 7 },
  { code: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪', maxLength: 11 },
  { code: 'GH', name: 'Ghana', dialCode: '+233', flag: '🇬🇭', maxLength: 9 },
  { code: 'GN', name: 'Guinea', dialCode: '+224', flag: '🇬🇳', maxLength: 9 },
  { code: 'HK', name: 'Hong Kong', dialCode: '+852', flag: '🇭🇰', maxLength: 8 },
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳', maxLength: 10 },
  { code: 'ID', name: 'Indonesia', dialCode: '+62', flag: '🇮🇩', maxLength: 11 },
  { code: 'IE', name: 'Ireland', dialCode: '+353', flag: '🇮🇪', maxLength: 9 },
  { code: 'IL', name: 'Israel', dialCode: '+972', flag: '🇮🇱', maxLength: 9 },
  { code: 'IT', name: 'Italy', dialCode: '+39', flag: '🇮🇹', maxLength: 10 },
  { code: 'JP', name: 'Japan', dialCode: '+81', flag: '🇯🇵', maxLength: 10 },
  { code: 'KE', name: 'Kenya', dialCode: '+254', flag: '🇰🇪', maxLength: 9 },
  { code: 'KW', name: 'Kuwait', dialCode: '+965', flag: '🇰🇼', maxLength: 8 },
  { code: 'LR', name: 'Liberia', dialCode: '+231', flag: '🇱🇷', maxLength: 9 },
  { code: 'MY', name: 'Malaysia', dialCode: '+60', flag: '🇲🇾', maxLength: 10 },
  { code: 'ML', name: 'Mali', dialCode: '+223', flag: '🇲🇱', maxLength: 8 },
  { code: 'MX', name: 'Mexico', dialCode: '+52', flag: '🇲🇽', maxLength: 10 },
  { code: 'MA', name: 'Morocco', dialCode: '+212', flag: '🇲🇦', maxLength: 9 },
  {
    code: 'MZ',
    name: 'Mozambique',
    dialCode: '+258',
    flag: '🇲🇿',
    maxLength: 9,
  },
  {
    code: 'NL',
    name: 'Netherlands',
    dialCode: '+31',
    flag: '🇳🇱',
    maxLength: 9,
  },
  {
    code: 'NZ',
    name: 'New Zealand',
    dialCode: '+64',
    flag: '🇳🇿',
    maxLength: 9,
  },
  { code: 'NE', name: 'Niger', dialCode: '+227', flag: '🇳🇪', maxLength: 8 },
  { code: 'NO', name: 'Norway', dialCode: '+47', flag: '🇳🇴', maxLength: 8 },
  { code: 'PK', name: 'Pakistan', dialCode: '+92', flag: '🇵🇰', maxLength: 10 },
  {
    code: 'PH',
    name: 'Philippines',
    dialCode: '+63',
    flag: '🇵🇭',
    maxLength: 10,
  },
  { code: 'PL', name: 'Poland', dialCode: '+48', flag: '🇵🇱', maxLength: 9 },
  { code: 'PT', name: 'Portugal', dialCode: '+351', flag: '🇵🇹', maxLength: 9 },
  { code: 'QA', name: 'Qatar', dialCode: '+974', flag: '🇶🇦', maxLength: 8 },
  { code: 'RW', name: 'Rwanda', dialCode: '+250', flag: '🇷🇼', maxLength: 9 },
  {
    code: 'SA',
    name: 'Saudi Arabia',
    dialCode: '+966',
    flag: '🇸🇦',
    maxLength: 9,
  },
  { code: 'SN', name: 'Senegal', dialCode: '+221', flag: '🇸🇳', maxLength: 9 },
  {
    code: 'SL',
    name: 'Sierra Leone',
    dialCode: '+232',
    flag: '🇸🇱',
    maxLength: 8,
  },
  { code: 'SG', name: 'Singapore', dialCode: '+65', flag: '🇸🇬', maxLength: 8 },
  {
    code: 'ZA',
    name: 'South Africa',
    dialCode: '+27',
    flag: '🇿🇦',
    maxLength: 9,
  },
  {
    code: 'KR',
    name: 'South Korea',
    dialCode: '+82',
    flag: '🇰🇷',
    maxLength: 10,
  },
  { code: 'ES', name: 'Spain', dialCode: '+34', flag: '🇪🇸', maxLength: 9 },
  { code: 'SE', name: 'Sweden', dialCode: '+46', flag: '🇸🇪', maxLength: 9 },
  {
    code: 'CH',
    name: 'Switzerland',
    dialCode: '+41',
    flag: '🇨🇭',
    maxLength: 9,
  },
  { code: 'TZ', name: 'Tanzania', dialCode: '+255', flag: '🇹🇿', maxLength: 9 },
  { code: 'TG', name: 'Togo', dialCode: '+228', flag: '🇹🇬', maxLength: 8 },
  { code: 'TR', name: 'Turkey', dialCode: '+90', flag: '🇹🇷', maxLength: 10 },
  { code: 'UG', name: 'Uganda', dialCode: '+256', flag: '🇺🇬', maxLength: 9 },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    dialCode: '+971',
    flag: '🇦🇪',
    maxLength: 9,
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    dialCode: '+44',
    flag: '🇬🇧',
    maxLength: 11,
  },
  {
    code: 'US',
    name: 'United States',
    dialCode: '+1',
    flag: '🇺🇸',
    maxLength: 10,
  },
  { code: 'ZM', name: 'Zambia', dialCode: '+260', flag: '🇿🇲', maxLength: 9 },
  { code: 'ZW', name: 'Zimbabwe', dialCode: '+263', flag: '🇿🇼', maxLength: 9 },
];

interface PhoneInputProps
  extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value?: string;
  onChangeText?: (value: string) => void;
  defaultCountry?: string; // ISO code
  containerStyle?: ViewStyle;
  error?: string;
  label?: string;
  returnKeyType?: TextInputProps['returnKeyType'];
}

export function PhoneInput({
  value = '',
  onChangeText,
  defaultCountry = 'NG',
  containerStyle,
  error,
  label,
  returnKeyType = 'next',
  placeholder = '8012345678',
  ...props
}: PhoneInputProps) {
  const [selectedCountry, setSelectedCountry] = useState<Country>(
    COUNTRIES.find((c) => c.code === defaultCountry) || COUNTRIES[0]
  );
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = (colorScheme ?? 'light') === 'dark';

  // Extract the local number from the full value
  const getLocalNumber = () => {
    if (!value) return '';
    // Remove country code if present
    if (value.startsWith(selectedCountry.dialCode)) {
      return value.slice(selectedCountry.dialCode.length);
    }
    // Remove + prefix and dial code without +
    const dialWithoutPlus = selectedCountry.dialCode.replace('+', '');
    if (value.startsWith(`+${dialWithoutPlus}`)) {
      return value.slice(dialWithoutPlus.length + 1);
    }
    if (value.startsWith(dialWithoutPlus)) {
      return value.slice(dialWithoutPlus.length);
    }
    return value;
  };

  const handlePhoneChange = (text: string) => {
    // Sanitize: only digits
    let cleaned = text.replace(/[^0-9]/g, '');

    // Strip leading zero for Nigerian numbers
    if (selectedCountry.code === 'NG' && cleaned.startsWith('0')) {
      cleaned = cleaned.slice(1);
    }

    // Prepend country code
    const fullNumber = cleaned ? `${selectedCountry.dialCode}${cleaned}` : '';
    onChangeText?.(fullNumber);
  };

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setShowCountryPicker(false);
    setSearchQuery('');
    // Re-format number with new country code
    const localNum = getLocalNumber();
    if (localNum) {
      onChangeText?.(`${country.dialCode}${localNum}`);
    }
  };

  const filteredCountries = searchQuery
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.dialCode.includes(searchQuery)
      )
    : COUNTRIES;

  return (
    <View style={containerStyle}>
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
          error && styles.containerError,
        ]}
      >
        {/* Country Selector Button */}
        <TouchableOpacity
          style={styles.countryButton}
          onPress={() => setShowCountryPicker(true)}
          accessibilityRole="button"
          accessibilityLabel={`Select country. Current: ${selectedCountry.name}`}
          accessibilityHint="Opens a modal to select a different country code"
          activeOpacity={0.7}
        >
          <Text
            style={styles.flag}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {selectedCountry.flag}
          </Text>
          <Ionicons
            name="chevron-down"
            size={14}
            color={colors.textSecondary}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </TouchableOpacity>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Country Code Display */}
        <Text style={[styles.dialCode, { color: colors.text }]}>
          {selectedCountry.dialCode}
        </Text>

        {/* Phone Input */}
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={getLocalNumber()}
          onChangeText={handlePhoneChange}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          accessibilityLabel={label || 'Phone number'}
          maxLength={selectedCountry.maxLength || 15}
          returnKeyType={returnKeyType}
          {...props}
        />
      </View>

      {/* Error Message */}
      {error && (
        <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
      )}

      {/* Country Picker Modal */}
      <Modal
        visible={showCountryPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: isDark ? colors.card : colors.background },
          ]}
        >
          {/* Header */}
          <View
            style={[styles.modalHeader, { borderBottomColor: colors.border }]}
          >
            <Text
              style={[styles.modalTitle, { color: colors.text }]}
              accessibilityRole="header"
            >
              Select Country
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowCountryPicker(false);
                setSearchQuery('');
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Close country picker"
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View
            style={[
              styles.searchContainer,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.05)'
                  : colors.muted,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons
              name="search"
              size={18}
              color={colors.textSecondary}
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search country..."
              placeholderTextColor={colors.placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Search for a country"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>

          {/* Country List */}
          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item.code}
            // Prevent UI thread blocking during modal open by virtualizing the 200+ country list
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={10}
            removeClippedSubviews={Platform.OS === 'android'}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.countryRow,
                  { borderBottomColor: colors.border },
                  item.code === selectedCountry.code && [
                    styles.countryRowSelected,
                    {
                      backgroundColor: isDark
                        ? 'rgba(217, 59, 48, 0.16)'
                        : palette.red[50],
                    },
                  ],
                ]}
                onPress={() => handleCountrySelect(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${item.dialCode}`}
                accessibilityState={{
                  selected: item.code === selectedCountry.code,
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={styles.countryFlag}
                  accessibilityElementsHidden={true}
                  importantForAccessibility="no"
                >
                  {item.flag}
                </Text>
                <Text
                  style={[styles.countryName, { color: colors.text }]}
                  accessibilityElementsHidden={true}
                  importantForAccessibility="no"
                >
                  {item.name}
                </Text>
                <Text
                  style={[
                    styles.countryDialCode,
                    { color: colors.textSecondary },
                  ]}
                  accessibilityElementsHidden={true}
                  importantForAccessibility="no"
                >
                  {item.dialCode}
                </Text>
                {item.code === selectedCountry.code && (
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={BRAND.primary}
                    accessibilityElementsHidden={true}
                    importantForAccessibility="no"
                  />
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No countries found
              </Text>
            }
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  containerError: {
    borderWidth: 1,
  },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 4,
  },
  flag: {
    fontSize: 20,
  },
  divider: {
    width: 1,
    height: 24,
  },
  dialCode: {
    fontSize: 15,
    fontWeight: '500',
    paddingLeft: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 14,
    paddingHorizontal: 8,
    paddingRight: 12,
  },
  error: {
    fontSize: 12,
    marginTop: 4,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  countryRowSelected: {},
  countryFlag: {
    fontSize: 24,
  },
  countryName: {
    flex: 1,
    fontSize: 15,
  },
  countryDialCode: {
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 24,
    fontSize: 15,
  },
});
