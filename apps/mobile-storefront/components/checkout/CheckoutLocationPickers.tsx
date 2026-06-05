import Ionicons from '@react-native-vector-icons/ionicons';
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import AppKeyboardContainer from '@/components/ui/AppKeyboardContainer';
import type Colors from '@/constants/Colors';
import { BRAND, palette } from '@/constants/Colors';
import { checkoutScreenViewStyles as styles } from './CheckoutScreenView.styles';

type ColorsScheme = (typeof Colors)['light'];

interface CheckoutLocationPickersProps {
  citySearch: string;
  citySearchFocused: boolean;
  colors: ColorsScheme;
  isDark: boolean;
  onChangeCitySearch: (value: string) => void;
  onCloseCityPicker: () => void;
  onCloseStatePicker: () => void;
  onSelectCity: (city: string) => void;
  onSelectState: (state: string) => void;
  onSetCitySearchFocused: (focused: boolean) => void;
  removeClippedSubviews: boolean;
  shippingCities: string[];
  shippingStates: string[];
  showCityPicker: boolean;
  showStatePicker: boolean;
  watchedCity: string;
  watchedState: string;
}

export function CheckoutLocationPickers({
  citySearch,
  citySearchFocused,
  colors,
  isDark,
  onChangeCitySearch,
  onCloseCityPicker,
  onCloseStatePicker,
  onSelectCity,
  onSelectState,
  onSetCitySearchFocused,
  removeClippedSubviews,
  shippingCities,
  shippingStates,
  showCityPicker,
  showStatePicker,
  watchedCity,
  watchedState,
}: CheckoutLocationPickersProps) {
  const typedCity = citySearch.trim();
  const filteredCities = typedCity
    ? shippingCities.filter((city) =>
        city.toLowerCase().includes(typedCity.toLowerCase())
      )
    : shippingCities;
  const exactCityMatch =
    typedCity.length > 0
      ? shippingCities.find(
          (city) => city.toLowerCase() === typedCity.toLowerCase()
        )
      : undefined;
  const hasExactCityMatch = Boolean(exactCityMatch);
  const shouldShowTypedCity = typedCity.length > 0 && !hasExactCityMatch;

  return (
    <>
      <Modal
        visible={showStatePicker}
        transparent
        animationType="slide"
        onRequestClose={onCloseStatePicker}
      >
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerSheet, { backgroundColor: colors.card }]}>
            <PickerHeader
              colors={colors}
              onClose={onCloseStatePicker}
              title="Select State"
            />
            <FlatList
              data={shippingStates}
              keyExtractor={(item) => item}
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={removeClippedSubviews}
              extraData={watchedState}
              renderItem={({ item }) => (
                <PickerRow
                  colors={colors}
                  isDark={isDark}
                  isSelected={item === watchedState}
                  item={item}
                  onSelect={onSelectState}
                />
              )}
              ListEmptyComponent={
                <Text
                  style={[styles.helperText, { color: colors.textSecondary }]}
                >
                  No states available.
                </Text>
              }
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCityPicker}
        transparent
        animationType="slide"
        onRequestClose={onCloseCityPicker}
      >
        <AppKeyboardContainer style={styles.pickerOverlay}>
          <View style={[styles.pickerSheet, { backgroundColor: colors.card }]}>
            <PickerHeader
              colors={colors}
              onClose={onCloseCityPicker}
              title="Select City"
            />
            <View
              style={[
                styles.citySearchContainer,
                {
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.05)'
                    : '#F9FAFB',
                  borderColor: citySearchFocused
                    ? BRAND.primary
                    : 'transparent',
                },
              ]}
            >
              <Ionicons
                name="search"
                size={16}
                color={citySearchFocused ? BRAND.primary : colors.textSecondary}
              />
              <TextInput
                style={[styles.citySearchInput, { color: colors.text }]}
                placeholder="Search or type your city..."
                placeholderTextColor={colors.textSecondary}
                value={citySearch}
                onChangeText={onChangeCitySearch}
                onFocus={() => onSetCitySearchFocused(true)}
                onBlur={() => onSetCitySearchFocused(false)}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (typedCity.length > 0) {
                    onSelectCity(exactCityMatch ?? typedCity);
                  }
                }}
              />
              {citySearch.length > 0 && (
                <Pressable onPress={() => onChangeCitySearch('')} hitSlop={8}>
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={colors.textSecondary}
                  />
                </Pressable>
              )}
            </View>
            {shouldShowTypedCity ? (
              <Pressable
                accessibilityLabel={`Use ${typedCity} as city`}
                accessibilityRole="button"
                onPress={() => onSelectCity(typedCity)}
                style={[
                  styles.pickerItem,
                  styles.customCityItem,
                  {
                    borderColor: isDark
                      ? 'rgba(245, 158, 11, 0.35)'
                      : 'rgba(245, 158, 11, 0.28)',
                  },
                ]}
              >
                <View style={styles.pickerItemContent}>
                  <View>
                    <Text style={styles.customCityLabel}>Use typed city</Text>
                    <Text
                      style={[styles.customCityText, { color: colors.text }]}
                    >
                      {typedCity}
                    </Text>
                  </View>
                  <Ionicons name="add-circle" size={20} color={BRAND.primary} />
                </View>
              </Pressable>
            ) : null}
            <FlatList
              data={filteredCities}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={removeClippedSubviews}
              extraData={watchedCity}
              renderItem={({ item }) => (
                <PickerRow
                  colors={colors}
                  isDark={isDark}
                  isSelected={item === watchedCity}
                  item={item}
                  onSelect={onSelectCity}
                />
              )}
              ListEmptyComponent={
                !citySearch.trim() ? (
                  <Text
                    style={[styles.helperText, { color: colors.textSecondary }]}
                  >
                    No cities available. Type your city above.
                  </Text>
                ) : null
              }
            />
          </View>
        </AppKeyboardContainer>
      </Modal>
    </>
  );
}

function PickerHeader({
  colors,
  onClose,
  title,
}: {
  colors: ColorsScheme;
  onClose: () => void;
  title: string;
}) {
  return (
    <View style={styles.pickerHeader}>
      <Text style={[styles.pickerTitle, { color: colors.text }]}>{title}</Text>
      <Pressable
        onPress={onClose}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={`Close ${title} picker`}
      >
        <Ionicons name="close" size={22} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

function PickerRow({
  colors,
  isDark,
  isSelected,
  item,
  onSelect,
}: {
  colors: ColorsScheme;
  isDark: boolean;
  isSelected: boolean;
  item: string;
  onSelect: (item: string) => void;
}) {
  return (
    <Pressable
      style={[
        styles.pickerItem,
        { borderBottomColor: colors.border },
        isSelected && {
          backgroundColor: isDark ? 'rgba(217, 59, 48, 0.14)' : palette.red[50],
        },
      ]}
      onPress={() => onSelect(item)}
    >
      <View style={styles.pickerItemContent}>
        <Text
          style={[
            styles.pickerItemText,
            {
              color: isSelected
                ? isDark
                  ? '#FDECEA'
                  : BRAND.primary
                : colors.text,
              fontWeight: isSelected ? '700' : '500',
            },
          ]}
        >
          {item}
        </Text>
        {isSelected && (
          <Ionicons name="checkmark" size={18} color={BRAND.primary} />
        )}
      </View>
    </Pressable>
  );
}
