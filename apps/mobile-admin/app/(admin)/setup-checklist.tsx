import Ionicons from '@react-native-vector-icons/ionicons';
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
import { SetupChecklistItem } from '@/components/setup/SetupChecklistItem';
import { StoreReadinessLoadError } from '@/components/setup/StoreReadinessLoadError';
import { getMobileStoreReadinessRoute } from '@/constants/store-readiness-routes';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useMerchant } from '@/hooks/useMerchant';
import { useStorePublish } from '@/hooks/useStorePublish';
import { useStoreReadiness } from '@/hooks/useStoreReadiness';
import { useTheme } from '@/hooks/useTheme';

export default function SetupChecklistScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { readiness, isLoading, isFetching, error, refetch } =
    useStoreReadiness();
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
      const result = await publishStore();
      if (result.status === 'stale') return;
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

  if (error && !readiness) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <StoreReadinessLoadError
          isRetrying={isFetching}
          onRetry={() => void refetch()}
        />
      </SafeAreaView>
    );
  }

  if (!readiness) return null;

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
          {readiness.items.map((item) => (
            <SetupChecklistItem
              colors={colors}
              isNext={!readiness.isPublished && item.id === nextItem?.id}
              item={item}
              key={item.id}
              onPress={() => router.push(getMobileStoreReadinessRoute(item.id))}
            />
          ))}
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
  emptyState: { alignItems: 'center', padding: SPACING.xl, gap: SPACING.md },
  emptyStateText: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});
