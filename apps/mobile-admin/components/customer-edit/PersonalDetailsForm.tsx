import Ionicons from '@react-native-vector-icons/ionicons';
import { Text, TextInput, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { customerEditStyles as styles } from '@/components/customer-edit/customer-edit.styles';
import type {
  CustomerEditShadows,
  CustomerEditThemeColors,
  InputStyleOptions,
} from '@/components/customer-edit/customer-edit.types';

interface PersonalDetailsFormProps {
  colors: CustomerEditThemeColors;
  companyName: string;
  customerType?: string | null;
  firstName: string;
  inputStyle: (fieldName: string) => InputStyleOptions;
  lastName: string;
  onCompanyNameChange: (value: string) => void;
  onFirstNameChange: (value: string) => void;
  onFocusField: (fieldName: string | null) => void;
  onLastNameChange: (value: string) => void;
  shadows: CustomerEditShadows;
}

export function PersonalDetailsForm({
  colors,
  companyName,
  customerType,
  firstName,
  inputStyle,
  lastName,
  onCompanyNameChange,
  onFirstNameChange,
  onFocusField,
  onLastNameChange,
  shadows,
}: PersonalDetailsFormProps) {
  const isCompany = customerType === 'company';
  const firstNameInput = inputStyle('firstName');
  const lastNameInput = inputStyle('lastName');
  const companyNameInput = inputStyle('companyName');

  return (
    <Animated.View
      entering={FadeInUp.delay(200).duration(500)}
      style={[styles.section, { backgroundColor: colors.card }, shadows.sm]}
    >
      <View style={styles.sectionHeader}>
        <Ionicons
          name={isCompany ? 'business-outline' : 'person-outline'}
          size={18}
          color={colors.primary}
        />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {isCompany ? 'Company Details' : 'Personal Details'}
        </Text>
      </View>

      {isCompany ? (
        <View style={styles.inputGroup}>
          <Text style={companyNameInput.label}>Company Name</Text>
          <TextInput
            style={companyNameInput.input}
            value={companyName}
            onBlur={() => onFocusField(null)}
            onChangeText={onCompanyNameChange}
            onFocus={() => onFocusField('companyName')}
            placeholder="Company Name"
            placeholderTextColor={colors.textMuted}
          />
        </View>
      ) : (
        <>
          <View style={styles.inputGroup}>
            <Text style={firstNameInput.label}>First Name</Text>
            <TextInput
              style={firstNameInput.input}
              value={firstName}
              onBlur={() => onFocusField(null)}
              onChangeText={onFirstNameChange}
              onFocus={() => onFocusField('firstName')}
              placeholder="First Name"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={lastNameInput.label}>Last Name</Text>
            <TextInput
              style={lastNameInput.input}
              value={lastName}
              onBlur={() => onFocusField(null)}
              onChangeText={onLastNameChange}
              onFocus={() => onFocusField('lastName')}
              placeholder="Last Name"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </>
      )}
    </Animated.View>
  );
}
