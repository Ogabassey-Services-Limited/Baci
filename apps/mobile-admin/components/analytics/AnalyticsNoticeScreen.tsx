import Ionicons, {
  type IoniconsIconName,
} from '@react-native-vector-icons/ionicons';
import { Stack } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface AnalyticsNoticeScreenProps {
  icon: IoniconsIconName;
  title: string;
  message: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

/**
 * Full-screen notice used by the analytics config screen for its non-editable
 * terminal states (query error with retry, staff owner-only notice), keeping
 * those branches out of the already oversized form screen.
 */
export function AnalyticsNoticeScreen({
  icon,
  title,
  message,
  action,
}: AnalyticsNoticeScreenProps) {
  const { colors } = useTheme();

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Analytics & Tracking',
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerTintColor: colors.text,
        }}
      />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <View
          style={[styles.banner, { backgroundColor: `${colors.primary}10` }]}
        >
          <Ionicons name={icon} size={24} color={colors.primary} />
          <View style={styles.content}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.message, { color: colors.textSecondary }]}>
              {message}
            </Text>
          </View>
        </View>
        {action && (
          <Pressable
            style={[styles.actionButton, { borderColor: colors.primary }]}
            onPress={action.onPress}
          >
            <Text style={[styles.actionText, { color: colors.primary }]}>
              {action.label}
            </Text>
          </Pressable>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SPACING.md,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    marginBottom: 4,
  },
  message: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: 20,
  },
  actionButton: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.md,
  },
  actionText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});
