import Ionicons from '@react-native-vector-icons/ionicons/static';
import {
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BRAND } from '@/constants/Colors';
import { checkoutContactCardStyles as styles } from './CheckoutContactCard.styles';

type CheckoutGuestSaveDetailsColors = {
  border: string;
  card: string;
  error: string;
  text: string;
  textSecondary: string;
};

type CheckoutGuestSaveDetailsProps = {
  accountPassword: string;
  colors: CheckoutGuestSaveDetailsColors;
  onChangeAccountPassword: (value: string) => void;
  onToggleSaveDetails: () => void;
  saveDetails: boolean;
};

export function CheckoutGuestSaveDetails({
  accountPassword,
  colors,
  onChangeAccountPassword,
  onToggleSaveDetails,
  saveDetails,
}: CheckoutGuestSaveDetailsProps) {
  const hasShortPassword = accountPassword.length > 0 && accountPassword.length < 6;

  return (
    <View style={styles.saveDetailsSection}>
      <Pressable
        accessibilityLabel="Save my details for faster checkout"
        accessibilityRole="checkbox"
        accessibilityState={{ checked: saveDetails }}
        onPress={onToggleSaveDetails}
        style={styles.checkboxRow}
      >
        <View
          style={[
            styles.checkbox,
            saveDetails && styles.checkboxChecked,
            { borderColor: saveDetails ? BRAND.primary : colors.border },
          ]}
        >
          {saveDetails ? (
            <Ionicons name="checkmark" size={14} color={BRAND.onPrimary} />
          ) : null}
        </View>
        <Text style={[styles.checkboxLabel, { color: colors.text }]}>
          Save my details for faster checkout
        </Text>
      </Pressable>

      {saveDetails ? (
        <>
          <View
            style={[
              styles.accountInfoBanner,
              { backgroundColor: BRAND.primaryAlpha06 },
            ]}
          >
            <Ionicons name="information-circle" size={18} color={BRAND.primary} />
            <Text style={[styles.accountInfoText, { color: colors.textSecondary }]}>
              This will create an account so you can track your order and
              checkout faster next time.
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Create a Password
            </Text>
            <TextInput
              accessibilityLabel="Create a password"
              autoComplete="new-password"
              onChangeText={onChangeAccountPassword}
              placeholder="Min. 6 characters"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: hasShortPassword ? colors.error : colors.border,
                  color: colors.text,
                },
              ]}
              textContentType="newPassword"
              value={accountPassword}
            />
            {hasShortPassword ? (
              <Text style={[styles.fieldError, { color: colors.error }]}>
                Password must be at least 6 characters
              </Text>
            ) : null}
          </View>
        </>
      ) : null}
    </View>
  );
}
