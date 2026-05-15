import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, TextInput, View } from 'react-native';
import { BRAND, withAlpha } from '@/constants/Colors';
import { styles } from './imei-check.styles';
import type { ImeiCheckerColors } from './imei-check.types';

interface ImeiCheckInputSectionProps {
  colors: ImeiCheckerColors;
  error: string | null;
  imei: string;
  onChangeImei: (value: string) => void;
  onCheck: () => void;
  onClearImei: () => void;
}

export function ImeiCheckInputSection({
  colors,
  error,
  imei,
  onChangeImei,
  onCheck,
  onClearImei,
}: ImeiCheckInputSectionProps) {
  return (
    <>
      <View
        style={[
          styles.inputCard,
          {
            backgroundColor: colors.card,
            borderColor: imei.length === 15 ? BRAND.primary : colors.border,
          },
        ]}
      >
        <View style={styles.inputHeader}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>
            Enter 15-digit IMEI
          </Text>
          <Text
            style={[
              styles.imeiCount,
              {
                color:
                  imei.length === 15 ? BRAND.primary : colors.textSecondary,
              },
            ]}
          >
            {imei.length}/15 digits
          </Text>
        </View>
        <View style={styles.inputWrapper}>
          <View
            style={[
              styles.inputIcon,
              { backgroundColor: withAlpha(BRAND.primary, 0.1) },
            ]}
          >
            <Ionicons name="barcode-outline" size={18} color={BRAND.primary} />
          </View>
          <TextInput
            style={[styles.imeiInput, { color: colors.text }]}
            value={imei}
            onChangeText={onChangeImei}
            placeholder="Enter 15-digit IMEI"
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
            maxLength={15}
            returnKeyType="go"
            onSubmitEditing={onCheck}
            autoComplete="off"
          />
          {imei.length > 0 && (
            <Pressable
              accessible={true}
              accessibilityHint="Clears the IMEI input"
              accessibilityLabel="Clear IMEI"
              accessibilityRole="button"
              onPress={onClearImei}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>
          )}
        </View>
        <View
          style={[
            styles.inputProgressTrack,
            { backgroundColor: withAlpha(BRAND.primary, 0.1) },
          ]}
        >
          <View
            style={[
              styles.inputProgressFill,
              {
                backgroundColor: BRAND.primary,
                width: `${(imei.length / 15) * 100}%`,
              },
            ]}
          />
        </View>
      </View>

      {error && (
        <View
          style={[
            styles.errorContainer,
            {
              backgroundColor: withAlpha(colors.error, 0.12),
              borderColor: withAlpha(colors.error, 0.3),
            },
          ]}
        >
          <Ionicons name="alert-circle" size={18} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </View>
      )}

      <View
        style={[
          styles.helpCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.helpHeader}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={BRAND.primary}
          />
          <Text style={[styles.helpTitle, { color: colors.text }]}>
            How to find your IMEI
          </Text>
        </View>
        <View style={styles.helpSteps}>
          <HelpStep colors={colors} number="1" text="Dial" boldText="*#06#" />
          <Ionicons
            name="chevron-forward"
            size={14}
            color={colors.textSecondary}
          />
          <HelpStep colors={colors} number="2" text="Copy 15 digits" />
          <Ionicons
            name="chevron-forward"
            size={14}
            color={colors.textSecondary}
          />
          <HelpStep colors={colors} number="3" text="Paste above" />
        </View>
      </View>
    </>
  );
}

function HelpStep({
  boldText,
  colors,
  number,
  text,
}: {
  boldText?: string;
  colors: ImeiCheckerColors;
  number: string;
  text: string;
}) {
  return (
    <View style={styles.helpStep}>
      <View style={styles.helpStepNumber}>
        <Text style={styles.helpStepNumberText}>{number}</Text>
      </View>
      <Text style={[styles.helpStepText, { color: colors.text }]}>
        {text}
        {boldText ? <Text style={styles.helpBold}> {boldText}</Text> : null}
      </Text>
    </View>
  );
}
