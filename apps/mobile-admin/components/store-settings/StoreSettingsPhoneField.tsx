import Ionicons from '@react-native-vector-icons/ionicons';
import type { StyleProp, ViewStyle } from 'react-native';
import { Text, View } from 'react-native';
import type { CountryCode } from 'react-native-country-picker-modal';
import PhoneInput from 'react-native-phone-number-input';
import { countryFlag } from '@/components/ui/country-flag';
import type { ThemeColors } from '@/constants/theme';
import { storeSettingsDetailsStyles as styles } from './StoreSettingsDetailsCard.styles';

interface StoreSettingsPhoneFieldProps {
  accessibilityLabel: string;
  colors: ThemeColors;
  countryCode: CountryCode;
  isDark: boolean;
  label: string;
  onChange: (phone: string) => void;
  placeholder: string;
  shadowStyle: StyleProp<ViewStyle>;
  value: string;
}

export function StoreSettingsPhoneField({
  accessibilityLabel,
  colors,
  countryCode,
  isDark,
  label,
  onChange,
  placeholder,
  shadowStyle,
  value,
}: StoreSettingsPhoneFieldProps) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card }, shadowStyle]}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <PhoneInput
        key={`${accessibilityLabel}-${countryCode}`}
        codeTextStyle={[styles.phoneCodeText, { color: colors.text }]}
        containerStyle={[
          styles.phoneContainer,
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}
        countryPickerProps={{
          renderFlagButton: ({
            countryCode: activeCountryCode,
          }: {
            countryCode?: CountryCode;
          }) => (
            <Text allowFontScaling={false} style={styles.phoneFlag}>
              {countryFlag({ code: activeCountryCode ?? countryCode })}
            </Text>
          ),
        }}
        countryPickerButtonStyle={styles.phoneCountryPicker}
        defaultCode={countryCode}
        defaultValue={value}
        layout="first"
        onChangeFormattedText={onChange}
        renderDropdownImage={
          <Ionicons
            color={colors.textSecondary}
            name="chevron-down"
            size={16}
          />
        }
        textContainerStyle={[
          styles.phoneTextContainer,
          { backgroundColor: colors.background },
        ]}
        textInputProps={{
          accessibilityLabel,
          placeholder,
          placeholderTextColor: colors.textMuted,
        }}
        textInputStyle={[styles.phoneTextInput, { color: colors.text }]}
        withDarkTheme={isDark}
        withShadow={false}
      />
    </View>
  );
}
