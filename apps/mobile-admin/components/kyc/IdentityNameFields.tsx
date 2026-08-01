import type React from 'react';
import { Text, TextInput, View } from 'react-native';
import type { useTheme } from '@/hooks/useTheme';
import { verificationCardStyles as styles } from './verification-card-styles';
import type { VerificationIdentityDraft } from './verification-identity';

interface IdentityNameFieldsProps {
  colors: ReturnType<typeof useTheme>['colors'];
  disabled: boolean;
  firstName: string;
  lastName: string;
  onIdentityChange: React.Dispatch<
    React.SetStateAction<VerificationIdentityDraft>
  >;
}

export default function IdentityNameFields({
  colors,
  disabled,
  firstName,
  lastName,
  onIdentityChange,
}: IdentityNameFieldsProps) {
  const inputColors = {
    backgroundColor: colors.inputBg,
    borderColor: colors.border,
    color: colors.text,
  };

  return (
    <View style={styles.nameRow} accessibilityLabel="First and last name">
      <View style={styles.nameField}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          First Name
        </Text>
        <TextInput
          style={[styles.input, inputColors]}
          placeholder="First name"
          placeholderTextColor={colors.textMuted}
          value={firstName}
          onChangeText={(value) =>
            onIdentityChange((current) => ({ ...current, firstName: value }))
          }
          autoCapitalize="words"
          maxLength={50}
          editable={!disabled}
          accessibilityLabel="First name input"
        />
      </View>
      <View style={styles.nameField}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Last Name
        </Text>
        <TextInput
          style={[styles.input, inputColors]}
          placeholder="Last name"
          placeholderTextColor={colors.textMuted}
          value={lastName}
          onChangeText={(value) =>
            onIdentityChange((current) => ({ ...current, lastName: value }))
          }
          autoCapitalize="words"
          maxLength={50}
          editable={!disabled}
          accessibilityLabel="Last name input"
        />
      </View>
    </View>
  );
}
