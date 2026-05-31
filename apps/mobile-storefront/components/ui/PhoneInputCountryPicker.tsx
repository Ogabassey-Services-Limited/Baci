import Ionicons from '@react-native-vector-icons/ionicons';
import {
  FlatList,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type Colors from '@/constants/Colors';
import { BRAND, palette } from '@/constants/Colors';
import type { Country } from './PhoneInput.countries';
import { phoneInputStyles as styles } from './PhoneInput.styles';

type ColorsScheme = (typeof Colors)['light'];

interface PhoneInputCountryPickerProps {
  colors: ColorsScheme;
  countries: Country[];
  isDark: boolean;
  onClose: () => void;
  onSelectCountry: (country: Country) => void;
  searchQuery: string;
  selectedCountry: Country;
  removeClippedSubviews: boolean;
  setSearchQuery: (value: string) => void;
  visible: boolean;
}

export function PhoneInputCountryPicker({
  colors,
  countries,
  isDark,
  onClose,
  onSelectCountry,
  searchQuery,
  selectedCountry,
  removeClippedSubviews,
  setSearchQuery,
  visible,
}: PhoneInputCountryPickerProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onDismiss={onClose}
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.modalContainer,
          { backgroundColor: isDark ? colors.card : colors.background },
        ]}
      >
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
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Close country picker"
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

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

        <FlatList
          data={countries}
          keyExtractor={(item) => item.code}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
          removeClippedSubviews={removeClippedSubviews}
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
              onPress={() => onSelectCountry(item)}
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
  );
}
