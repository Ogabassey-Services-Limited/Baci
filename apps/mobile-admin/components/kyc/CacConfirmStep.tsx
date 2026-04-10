import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { CacCompany } from './cac-types';

interface CacConfirmStepProps {
  company: CacCompany;
  onBack: () => void;
  onConfirm: () => void;
}

export default function CacConfirmStep({
  company,
  onBack,
  onConfirm,
}: CacConfirmStepProps) {
  const { colors } = useTheme();

  return (
    <>
      <View style={[styles.confirmBox, { backgroundColor: colors.inputBg }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Company Name
        </Text>
        <Text style={[styles.value, { color: colors.text }]}>
          {company.approvedName}
        </Text>
        <Text
          style={[
            styles.label,
            { color: colors.textSecondary, marginTop: SPACING.sm },
          ]}
        >
          RC Number
        </Text>
        <Text style={[styles.value, { color: colors.text }]}>
          {company.rcNumber}
        </Text>
        <Text
          style={[
            styles.label,
            { color: colors.textSecondary, marginTop: SPACING.sm },
          ]}
        >
          Status
        </Text>
        <Text style={[styles.value, { color: colors.text }]}>
          {company.status}
        </Text>
      </View>
      <View style={styles.buttonRow}>
        <Pressable
          style={({ pressed }) => [
            styles.buttonOutline,
            { borderColor: colors.border },
            pressed && styles.pressed,
          ]}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back to previous step"
        >
          <Text style={[styles.buttonOutlineText, { color: colors.text }]}>
            Back
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
          ]}
          onPress={onConfirm}
          accessibilityRole="button"
          accessibilityLabel="Confirm company details and upload certificate"
        >
          <Text style={[styles.buttonText, { color: colors.textOnPrimary }]}>
            Confirm & Upload Certificate
          </Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  confirmBox: { borderRadius: RADIUS.sm, padding: SPACING.md },
  label: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
  },
  value: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
    marginTop: SPACING.xs,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  buttonOutline: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  buttonOutlineText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.md,
  },
  button: {
    flex: 1,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
  pressed: {
    opacity: 0.7,
  },
});
