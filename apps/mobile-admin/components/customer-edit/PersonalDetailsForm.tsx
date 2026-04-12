import { Ionicons } from '@expo/vector-icons';
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
  firstName: string;
  inputStyle: (fieldName: string) => InputStyleOptions;
  lastName: string;
  onFirstNameChange: (value: string) => void;
  onFocusField: (fieldName: string | null) => void;
  onLastNameChange: (value: string) => void;
  shadows: CustomerEditShadows;
}

export function PersonalDetailsForm({
  colors,
  firstName,
  inputStyle,
  lastName,
  onFirstNameChange,
  onFocusField,
  onLastNameChange,
  shadows,
}: PersonalDetailsFormProps) {
  const firstNameInput = inputStyle('firstName');
  const lastNameInput = inputStyle('lastName');

  return (
    <Animated.View
      entering={FadeInUp.delay(200).duration(500)}
      style={[styles.section, { backgroundColor: colors.card }, shadows.sm]}
    >
      <View style={styles.sectionHeader}>
        <Ionicons name="person-outline" size={18} color={colors.primary} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Personal Details
        </Text>
      </View>

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
    </Animated.View>
  );
}
