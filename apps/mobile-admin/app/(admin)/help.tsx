import Ionicons, { type IoniconsIconName } from "@react-native-vector-icons/ionicons/static";
import { Stack, useRouter } from 'expo-router';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface HelpTopic {
  id: string;
  icon: IoniconsIconName;
  title: string;
  description: string;
}

export default function HelpCenterScreen() {
  const { colors, shadows, isDark } = useTheme();
  const router = useRouter();

  const helpTopics: HelpTopic[] = [
    {
      id: 'getting-started',
      icon: 'rocket-outline',
      title: 'Getting Started',
      description: 'Learn the basics of your store',
    },
    {
      id: 'orders',
      icon: 'cube-outline',
      title: 'Managing Orders',
      description: 'Process and fulfill orders',
    },
    {
      id: 'products',
      icon: 'pricetag-outline',
      title: 'Product Management',
      description: 'Add and edit products',
    },
    {
      id: 'payments',
      icon: 'card-outline',
      title: 'Payments & Payouts',
      description: 'Payment setup and withdrawals',
    },
    {
      id: 'shipping',
      icon: 'car-outline',
      title: 'Shipping & Delivery',
      description: 'Configure delivery options',
    },
  ];

  const handleOpenHelp = () => {
    Linking.openURL('https://mybaci.store/help');
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Help Center',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <SystemBars style={isDark ? 'light' : 'dark'} />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Search Card */}
          <Pressable
            style={[styles.searchCard, { backgroundColor: colors.primary }]}
            onPress={handleOpenHelp}
          >
            <Ionicons name="search" size={24} color="#FFFFFF" />
            <Text style={styles.searchText}>Search help articles...</Text>
          </Pressable>

          {/* Topics */}
          <View
            style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Browse Topics
            </Text>

            {helpTopics.map((topic, index) => (
              <Pressable key={topic.id} onPress={handleOpenHelp}>
                {index > 0 && (
                  <View
                    style={[styles.divider, { backgroundColor: colors.border }]}
                  />
                )}
                <View style={styles.topicRow}>
                  <View
                    style={[
                      styles.topicIcon,
                      { backgroundColor: colors.cardHover },
                    ]}
                  >
                    <Ionicons
                      name={topic.icon}
                      size={22}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.topicInfo}>
                    <Text style={[styles.topicTitle, { color: colors.text }]}>
                      {topic.title}
                    </Text>
                    <Text
                      style={[
                        styles.topicDescription,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {topic.description}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.textMuted}
                  />
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backButton: { padding: SPACING.sm, marginLeft: -SPACING.sm },
  scrollView: { flex: 1 },
  scrollContent: { padding: SPACING.lg, paddingBottom: SPACING['3xl'] },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
  },
  searchText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  card: { borderRadius: RADIUS.lg, padding: SPACING.lg },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: SPACING.md,
  },
  divider: { height: 1, marginVertical: SPACING.md },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  topicIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicInfo: { flex: 1 },
  topicTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  topicDescription: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
});
