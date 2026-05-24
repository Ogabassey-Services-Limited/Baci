import Ionicons from "@react-native-vector-icons/ionicons/static";
import { Text, TextInput, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { customerEditStyles as styles } from '@/components/customer-edit/customer-edit.styles';
import type {
  CustomerEditShadows,
  CustomerEditThemeColors,
  InputStyleOptions,
} from '@/components/customer-edit/customer-edit.types';

interface LocationFormProps {
  address: string;
  colors: CustomerEditThemeColors;
  inputStyle: (fieldName: string) => InputStyleOptions;
  onAddressChange: (value: string) => void;
  onFocusField: (fieldName: string | null) => void;
  shadows: CustomerEditShadows;
}

export function LocationForm({
  address,
  colors,
  inputStyle,
  onAddressChange,
  onFocusField,
  shadows,
}: LocationFormProps) {
  const addressInput = inputStyle('address');

  return (
    <Animated.View
      entering={FadeInUp.delay(400).duration(500)}
      style={[styles.section, { backgroundColor: colors.card }, shadows.sm]}
    >
      <View style={styles.sectionHeader}>
        <Ionicons name="location-outline" size={18} color={colors.primary} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Location
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={addressInput.label}>Shipping Address</Text>
        <TextInput
          multiline
          numberOfLines={3}
          style={[addressInput.input, styles.textArea]}
          value={address}
          onBlur={() => onFocusField(null)}
          onChangeText={onAddressChange}
          onFocus={() => onFocusField('address')}
          placeholder="Street address, City, State"
          placeholderTextColor={colors.textMuted}
        />
      </View>
    </Animated.View>
  );
}
