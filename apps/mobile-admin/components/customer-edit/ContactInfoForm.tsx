import Ionicons from "@react-native-vector-icons/ionicons/static";
import { Text, TextInput, View } from 'react-native';
import PhoneInput from 'react-native-phone-number-input';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { customerEditStyles as styles } from '@/components/customer-edit/customer-edit.styles';
import type {
  CustomerEditShadows,
  CustomerEditThemeColors,
  InputStyleOptions,
} from '@/components/customer-edit/customer-edit.types';

interface ContactInfoFormProps {
  colors: CustomerEditThemeColors;
  customerId?: string;
  email: string;
  inputStyle: (fieldName: string) => InputStyleOptions;
  isDark: boolean;
  onEmailChange: (value: string) => void;
  onFocusField: (fieldName: string | null) => void;
  onPhoneChange: (value: string) => void;
  phone: string;
  shadows: CustomerEditShadows;
}

export function ContactInfoForm({
  colors,
  customerId,
  email,
  inputStyle,
  isDark,
  onEmailChange,
  onFocusField,
  onPhoneChange,
  phone,
  shadows,
}: ContactInfoFormProps) {
  const emailInput = inputStyle('email');
  const phoneInput = inputStyle('phone');

  return (
    <Animated.View
      entering={FadeInUp.delay(300).duration(500)}
      style={[styles.section, { backgroundColor: colors.card }, shadows.sm]}
    >
      <View style={styles.sectionHeader}>
        <Ionicons name="call-outline" size={18} color={colors.primary} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Contact Info
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={emailInput.label}>Email Address *</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          style={emailInput.input}
          value={email}
          onBlur={() => onFocusField(null)}
          onChangeText={onEmailChange}
          onFocus={() => onFocusField('email')}
          placeholder="Email"
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Phone Number
        </Text>
        <PhoneInput
          key={`phone-${customerId ?? 'new'}`}
          defaultCode="NG"
          defaultValue={phone}
          layout="first"
          onChangeFormattedText={onPhoneChange}
          containerStyle={[
            styles.phoneContainer,
            {
              backgroundColor: phoneInput.state.backgroundColor,
              borderColor: phoneInput.state.borderColor,
            },
          ]}
          textContainerStyle={styles.phoneTextContainer}
          textInputProps={{
            onBlur: () => onFocusField(null),
            onFocus: () => onFocusField('phone'),
            placeholderTextColor: colors.textMuted,
          }}
          textInputStyle={[styles.phoneTextInput, { color: colors.text }]}
          codeTextStyle={[styles.phoneCodeText, { color: colors.text }]}
          withDarkTheme={isDark}
          withShadow={false}
        />
      </View>
    </Animated.View>
  );
}
