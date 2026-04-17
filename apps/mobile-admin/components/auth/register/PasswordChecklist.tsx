import { Text, View } from 'react-native';
import type { PasswordValidationResult } from '@/lib/password-utils';
import { ChecklistItem } from './ChecklistItem';
import { useTheme } from '@/hooks/useTheme';
import { getStyles } from './register.styles';

interface PasswordChecklistProps {
  passwordState: PasswordValidationResult;
  passwordValue: string;
}

export function PasswordChecklist({
  passwordState,
  passwordValue,
}: PasswordChecklistProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
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
                    ? colors.error
                    : passwordState.strength === 2
                      ? colors.warning
                      : colors.success
                  : colors.border,
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
                    ? colors.warning
                    : colors.success
                  : colors.border,
              width: '32%',
            },
          ]}
        />
        <View
          style={[
            styles.strengthBar,
            {
              backgroundColor:
                passwordState.strength > 2 ? colors.success : colors.border,
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
