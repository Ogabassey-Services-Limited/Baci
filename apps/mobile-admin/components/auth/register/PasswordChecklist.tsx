import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import type { PasswordValidationResult } from '@/lib/password-utils';
import { registerStyles as styles } from './register.styles';

interface PasswordChecklistProps {
  passwordState: PasswordValidationResult;
  passwordValue: string;
}

export function PasswordChecklist({
  passwordState,
  passwordValue,
}: PasswordChecklistProps) {
  return (
    <View style={styles.validationContainer}>
      <Text style={styles.validationTitle}>Password Strength</Text>

      <View style={styles.strengthMeter}>
        <View
          style={[
            styles.strengthBar,
            {
              backgroundColor:
                passwordState.strength > 0
                  ? passwordState.strength === 1
                    ? '#EF4444'
                    : passwordState.strength === 2
                      ? '#F59E0B'
                      : '#10B981'
                  : '#374151',
              width: '32%',
            },
          ]}
        />
        <View
          style={[
            styles.strengthBar,
            {
              backgroundColor:
                passwordState.strength > 1
                  ? passwordState.strength === 2
                    ? '#F59E0B'
                    : '#10B981'
                  : '#374151',
              width: '32%',
            },
          ]}
        />
        <View
          style={[
            styles.strengthBar,
            {
              backgroundColor:
                passwordState.strength > 2 ? '#10B981' : '#374151',
              width: '32%',
            },
          ]}
        />
      </View>

      <View style={styles.checklist}>
        <ChecklistItem
          isValid={passwordState.requirements.length}
          text="At least 8 characters"
        />
        <ChecklistItem
          isValid={passwordState.requirements.complexity}
          text="Complexity (longer or mixed types)"
        />
        <ChecklistItem
          isError={
            !passwordState.requirements.notCommon && passwordValue.length > 0
          }
          isValid={passwordState.requirements.notCommon}
          text="Not a common password"
        />
      </View>
    </View>
  );
}

function ChecklistItem({
  isError = false,
  isValid,
  text,
}: {
  isError?: boolean;
  isValid: boolean;
  text: string;
}) {
  const iconName = isValid
    ? 'checkmark-circle'
    : isError
      ? 'alert-circle-outline'
      : 'ellipse-outline';
  const iconColor = isValid ? '#10B981' : isError ? '#EF4444' : '#9CA3AF';
  const textStyle = isValid
    ? styles.checkTextValid
    : isError
      ? styles.checkTextError
      : styles.checkText;

  return (
    <View style={styles.checkItem}>
      <Ionicons name={iconName} size={14} color={iconColor} />
      <Text style={textStyle}>{text}</Text>
    </View>
  );
}
