import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import Ionicons from '@react-native-vector-icons/ionicons';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { useState } from 'react';
import { Keyboard, Pressable, Text, View } from 'react-native';
import type { CountryCode } from 'react-native-country-picker-modal';
import {
  SheetTextInput,
  type SheetTextInputRef,
} from '@/components/ui/SheetTextInput';
import type { ThemeColors } from '@/constants/theme';
import {
  formatPhoneNumberForCountry,
  getNationalPhoneNumber,
  getPhoneCountryByCode,
  PHONE_COUNTRIES,
} from '@/lib/phone-country';
import { customerCreateStyles as customerStyles } from './NewOrderCustomerCreateView.styles';
import { DEFAULT_COUNTRY_CODE } from './new-order.shared';
import type { NewCustomerDraft } from './new-order.types';

interface NewOrderCustomerContactSectionProps {
  colors: ThemeColors;
  emailInputRef: RefObject<SheetTextInputRef | null>;
  newCustomer: NewCustomerDraft;
  phoneInputRef: RefObject<SheetTextInputRef | null>;
  selectedCountryCode: CountryCode;
  setNewCustomer: Dispatch<SetStateAction<NewCustomerDraft>>;
  setSelectedCountryCode: Dispatch<SetStateAction<CountryCode>>;
}

export function NewOrderCustomerContactSection({
  colors,
  emailInputRef,
  newCustomer,
  phoneInputRef,
  selectedCountryCode,
  setNewCustomer,
  setSelectedCountryCode,
}: NewOrderCustomerContactSectionProps) {
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const selectedPhoneCountry = getPhoneCountryByCode(
    selectedCountryCode || DEFAULT_COUNTRY_CODE
  );
  const nationalPhoneNumber = getNationalPhoneNumber(newCustomer.phone);
  const normalizedCountrySearch = countrySearch.trim().toLowerCase();
  const filteredPhoneCountries = normalizedCountrySearch
    ? PHONE_COUNTRIES.filter(
        (country) =>
          country.name.toLowerCase().includes(normalizedCountrySearch) ||
          country.code.toLowerCase().includes(normalizedCountrySearch) ||
          country.callingCode.includes(normalizedCountrySearch)
      )
    : PHONE_COUNTRIES;

  return (
    <View style={[customerStyles.section, { zIndex: 5 }]}>
      <View style={customerStyles.sectionHeader}>
        <View
          style={[
            customerStyles.sectionIcon,
            { backgroundColor: colors.successLight },
          ]}
        >
          <Ionicons color={colors.success} name="call-outline" size={17} />
        </View>
        <Text style={[customerStyles.sectionTitle, { color: colors.text }]}>
          Contact Info
        </Text>
      </View>

      <View
        style={[
          customerStyles.phoneField,
          { backgroundColor: colors.inputBg, borderColor: colors.border },
        ]}
      >
        <Pressable
          accessibilityHint="Opens a compact country picker"
          accessibilityLabel={`Select phone country, currently ${selectedPhoneCountry.name}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: showCountryDropdown }}
          onPress={() => {
            Keyboard.dismiss();
            setShowCountryDropdown((isVisible) => !isVisible);
          }}
          style={customerStyles.countryButton}
        >
          <Text style={customerStyles.countryFlag}>
            {selectedPhoneCountry.flagEmoji}
          </Text>
          <Text style={[customerStyles.countryCode, { color: colors.text }]}>
            +{selectedPhoneCountry.callingCode}
          </Text>
          <Ionicons
            color={colors.textMuted}
            name={showCountryDropdown ? 'chevron-up' : 'chevron-down'}
            size={15}
          />
        </Pressable>
        <View
          style={[
            customerStyles.fieldDivider,
            { backgroundColor: colors.border },
          ]}
        />
        <Ionicons color={colors.textMuted} name="call-outline" size={18} />
        <SheetTextInput
          ref={phoneInputRef}
          accessibilityLabel="Phone Number"
          keyboardType="phone-pad"
          onChangeText={(text) =>
            setNewCustomer((previous) => ({
              ...previous,
              phone: formatPhoneNumberForCountry(text, selectedPhoneCountry),
            }))
          }
          onSubmitEditing={() => emailInputRef.current?.focus()}
          placeholder="Mobile Phone"
          placeholderTextColor={colors.textMuted}
          returnKeyType="next"
          submitBehavior="submit"
          style={[customerStyles.fieldInput, { color: colors.text }]}
          value={nationalPhoneNumber}
        />
      </View>

      {showCountryDropdown ? (
        <View
          style={[
            customerStyles.countryDropdown,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View
            style={[
              customerStyles.countrySearchRow,
              { backgroundColor: colors.inputBg, borderColor: colors.border },
            ]}
          >
            <Ionicons color={colors.textMuted} name="search" size={17} />
            <SheetTextInput
              accessibilityLabel="Search phone countries"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setCountrySearch}
              placeholder="Search country or code..."
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              style={[customerStyles.fieldInput, { color: colors.text }]}
              value={countrySearch}
            />
            <Pressable
              accessibilityLabel="Close country picker"
              accessibilityRole="button"
              onPress={() => {
                setCountrySearch('');
                setShowCountryDropdown(false);
              }}
            >
              <Ionicons
                color={colors.textMuted}
                name="close-circle"
                size={20}
              />
            </Pressable>
          </View>
          <BottomSheetFlatList
            data={filteredPhoneCountries}
            keyExtractor={(country) => country.code}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            renderItem={({ item: country }) => {
              const isSelected = country.code === selectedPhoneCountry.code;
              return (
                <Pressable
                  accessibilityLabel={`Use ${country.name} +${country.callingCode}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => {
                    setSelectedCountryCode(country.code as CountryCode);
                    setNewCustomer((previous) => ({
                      ...previous,
                      phone: formatPhoneNumberForCountry(
                        nationalPhoneNumber,
                        country
                      ),
                    }));
                    setCountrySearch('');
                    setShowCountryDropdown(false);
                  }}
                  style={[
                    customerStyles.countryRow,
                    {
                      backgroundColor: isSelected
                        ? colors.primaryLight
                        : colors.backgroundLight,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={customerStyles.countryFlag}>
                    {country.flagEmoji}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        customerStyles.countryName,
                        { color: colors.text },
                      ]}
                    >
                      {country.name}
                    </Text>
                    <Text style={{ color: colors.textSecondary }}>
                      +{country.callingCode}
                    </Text>
                  </View>
                  {isSelected ? (
                    <Ionicons
                      color={colors.primary}
                      name="checkmark-circle"
                      size={20}
                    />
                  ) : null}
                </Pressable>
              );
            }}
            style={customerStyles.countryList}
          />
        </View>
      ) : null}

      <View
        style={[
          customerStyles.field,
          { backgroundColor: colors.inputBg, borderColor: colors.border },
        ]}
      >
        <Ionicons color={colors.primary} name="mail-outline" size={18} />
        <SheetTextInput
          ref={emailInputRef}
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={(text) =>
            setNewCustomer((previous) => ({ ...previous, email: text }))
          }
          onSubmitEditing={() => Keyboard.dismiss()}
          placeholder="Email Address (Optional)"
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          style={[customerStyles.fieldInput, { color: colors.text }]}
          value={newCustomer.email}
        />
      </View>
    </View>
  );
}
