import Ionicons from "@react-native-vector-icons/ionicons/static";
import { StyleSheet, Text, View } from 'react-native';
import { SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface VerificationStatusBadgeProps {
  verified: boolean;
}

export default function VerificationStatusBadge({
  verified,
}: VerificationStatusBadgeProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: verified ? colors.successLight : colors.inputBg,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={verified ? 'Verified' : 'Not Started'}
    >
      {verified && (
        <Ionicons name="checkmark-circle" size={14} color={colors.success} />
      )}
      <Text
        style={[
          styles.label,
          { color: verified ? colors.success : colors.textMuted },
        ]}
      >
        {verified ? 'Verified' : 'Not Started'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 9999,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.xs,
  },
});
