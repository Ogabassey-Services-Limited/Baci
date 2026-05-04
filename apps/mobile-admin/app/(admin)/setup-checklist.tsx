import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ThemeColors } from '@/constants/theme';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useMerchant } from '@/hooks/useMerchant';
import { useStorePublish } from '@/hooks/useStorePublish';
import { useStoreReadiness } from '@/hooks/useStoreReadiness';
import { useTheme } from '@/hooks/useTheme';
import type { SetupItem } from '@/types/readiness';

const CATEGORY_ICONS: Record<string, string> = {
  payments: 'card-outline',
  products: 'cube-outline',
  store: 'storefront-outline',
  legal: 'document-text-outline',
  marketing: 'megaphone-outline',
};

const getPriorityColors = (colors: ThemeColors) => ({
  required: { bg: colors.errorLight, border: colors.error, text: colors.error },
  recommended: {
    bg: colors.warningLight,
    border: colors.warning,
    text: colors.warning,
  },
  optional: { bg: colors.infoLight, border: colors.info, text: colors.info },
});

const PRIORITY_LABELS = {
  required: 'Required',
  recommended: 'Recommended',
  optional: 'Optional',
};

export default function SetupChecklistScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { readiness, isLoading, refetch } = useStoreReadiness();
  const { merchant } = useMerchant();
  const { isPublishing, publishStore } = useStorePublish({
    merchantId: merchant?.id,
    onPublished: refetch,
  });

  const handlePublish = async () => {
    if (!readiness?.isReady) {
      Alert.alert(
        'Not Ready',
        'Please complete all required items to publish your store.'
      );
      return;
    }

    try {
      await publishStore();
      Alert.alert('Success', 'Your store is now LIVE!');
    } catch (error) {
      console.error('Publish error:', error);
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Failed to publish store. Please try again.'
      );
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!readiness) return null;

  const renderItem = (item: SetupItem, isNext: boolean) => {
    const priorityColor = getPriorityColors(colors)[item.priority];
    const _iconName =
      (CATEGORY_ICONS[item.category] as keyof typeof Ionicons.glyphMap) ||
      'list-outline';

    return (
      <Pressable
        key={item.id}
        onPress={() =>
          item.href.startsWith('/')
            ? router.push(item.href as Parameters<typeof router.push>[0])
            : undefined
        }
        style={[
          styles.itemCard,
          {
            backgroundColor: colors.card,
            borderColor: item.completed
              ? isDark
                ? '#065F46'
                : '#DCFCE7' // Green tint
              : isNext
                ? colors.primary
                : colors.border,
            borderWidth: isNext ? 2 : 1,
          },
          item.completed && { opacity: 0.8 },
        ]}
      >
        {/* Status Icon */}
        <View
          style={[
            styles.statusIcon,
            {
              backgroundColor: item.completed
                ? colors.success
                : isNext
                  ? colors.primaryLight
                  : colors.cardHover,
            },
          ]}
        >
          <Ionicons
            name={
              item.completed
                ? 'checkmark'
                : isNext
                  ? 'arrow-forward'
                  : 'ellipse-outline'
            }
            size={18}
            color={
              item.completed
                ? '#fff'
                : isNext
                  ? colors.primary
                  : colors.textMuted
            }
          />
        </View>

        {/* Content */}
        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <Text
              style={[
                styles.itemLabel,
                {
                  color: colors.text,
                  textDecorationLine: item.completed ? 'line-through' : 'none',
                },
              ]}
            >
              {item.label}
            </Text>
            {!item.completed && !isNext && (
              <View
                style={[
                  styles.priorityBadge,
                  {
                    backgroundColor: priorityColor.bg,
                    borderColor: priorityColor.border,
                  },
                ]}
              >
                <Text
                  style={[styles.priorityText, { color: priorityColor.text }]}
                >
                  {PRIORITY_LABELS[item.priority]}
                </Text>
              </View>
            )}
            {isNext && (
              <View
                style={[
                  styles.priorityBadge,
                  {
                    backgroundColor: colors.primaryLight,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Text style={[styles.priorityText, { color: colors.primary }]}>
                  NEXT STEP
                </Text>
              </View>
            )}
          </View>
          <Text
            style={[styles.itemDescription, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {item.description}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Pressable>
    );
  };

  // Determine the next incomplete item to leverage "Next Step" highlighting
  const incompleteItems = readiness.items.filter((i) => !i.completed);
  const nextItem = incompleteItems[0]; // Logic matches web

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      <Stack.Screen
        options={{ title: 'Store Setup', headerBackTitle: 'Back' }}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Card */}
        <View
          style={[
            styles.headerCard,
            {
              backgroundColor: isPublishing ? colors.card : colors.infoLight,
              borderColor: isPublishing ? colors.border : colors.info,
              borderWidth: 1,
            },
          ]}
        >
          <View style={styles.headerRow}>
            <View style={styles.headerTextContainer}>
              <Text
                style={[
                  styles.headerTitle,
                  { color: isPublishing ? colors.text : colors.info },
                ]}
              >
                {readiness.isPublished
                  ? 'Store is Live 🚀'
                  : readiness.isReady
                    ? 'Ready to Launch 🚀'
                    : 'Finish Setup'}
              </Text>
              <Text
                style={[
                  styles.headerSubtitle,
                  { color: isPublishing ? colors.textSecondary : colors.info },
                ]}
              >
                {readiness.isPublished
                  ? 'Keep improving your store to boost sales.'
                  : readiness.isReady
                    ? 'All required steps complete!'
                    : `${readiness.completedRequired} of ${readiness.totalRequired} required steps complete`}
              </Text>
            </View>
            <View
              style={[
                styles.progressCircle,
                { backgroundColor: colors.infoLight, borderColor: colors.info },
              ]}
            >
              <Text style={[styles.progressText, { color: colors.info }]}>
                {readiness.overallProgress}%
              </Text>
            </View>
          </View>

          {/* Publish Button */}
          {!readiness.isPublished && readiness.isReady && (
            <Pressable
              style={[
                styles.publishButton,
                { backgroundColor: colors.primary },
              ]}
              onPress={handlePublish}
              disabled={isPublishing}
            >
              {isPublishing ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text
                  style={[
                    styles.publishButtonText,
                    { color: colors.textOnPrimary },
                  ]}
                >
                  Publish Store Now
                </Text>
              )}
            </Pressable>
          )}
        </View>

        {/* Items List */}
        <View style={styles.listContainer}>
          {readiness.items.map((item) =>
            renderItem(item, !readiness.isPublished && item.id === nextItem?.id)
          )}
        </View>

        {/* Success State if empty */}
        {readiness.items.every((i) => i.completed) && (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={48} color={colors.gold} />
            <Text style={[styles.emptyStateText, { color: colors.text }]}>
              You've completed everything!
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: SPACING.lg },
  headerCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTextContainer: { flex: 1, marginRight: SPACING.md },
  headerTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: SPACING.xs,
  },
  headerSubtitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  progressCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  progressText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  publishButton: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  publishButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.md,
  },
  listContainer: { gap: SPACING.md },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  statusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  itemContent: { flex: 1, marginRight: SPACING.sm },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  itemLabel: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    marginRight: SPACING.sm,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  priorityText: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    textTransform: 'uppercase',
  },
  itemDescription: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  emptyState: { alignItems: 'center', padding: SPACING.xl, gap: SPACING.md },
  emptyStateText: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});
