import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SafeImage from '@/components/ui/SafeImage';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

type Tab = 'all' | 'draft' | 'published';

interface BlogPost {
  id: string;
  title: string;
  status: 'draft' | 'published';
  created_at: string;
  featured_image_url: string | null;
}

interface AgentStatus {
  status: 'active' | 'paused';
  last_run_at: string | null;
}

async function fetchBlogPosts(merchantId: string): Promise<BlogPost[]> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('id, title, status, created_at, featured_image_url')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

async function fetchMerchantAgentStatus(
  merchantId: string
): Promise<AgentStatus | null> {
  const { data, error } = await supabase
    .from('merchant_agents')
    .select('status, last_run_at')
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export default function BlogListScreen() {
  const { colors, isDark } = useTheme();
  const { merchant } = useMerchant();
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [allPosts, setAllPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Agent Status
  const [agent, setAgent] = useState<AgentStatus | null>(null);
  const [agentLoading, setAgentLoading] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      if (!merchant?.id) {
        if (isMounted) {
          setAllPosts([]);
          setAgent(null);
          setIsLoading(false);
          setAgentLoading(false);
        }
        return;
      }

      if (isMounted) {
        setIsLoading(true);
        setAgentLoading(true);
      }

      try {
        const [posts, agentStatus] = await Promise.all([
          fetchBlogPosts(merchant.id),
          fetchMerchantAgentStatus(merchant.id),
        ]);
        if (!isMounted) return;
        setAllPosts(posts);
        setAgent(agentStatus);
      } catch (error) {
        console.error(error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setAgentLoading(false);
        }
      }
    };

    void loadInitialData();

    return () => {
      isMounted = false;
    };
  }, [merchant?.id]);

  const onRefresh = () => {
    if (!merchant?.id) {
      setIsRefreshing(false);
      return;
    }

    setIsRefreshing(true);

    const refreshData = async () => {
      try {
        const [posts, agentStatus] = await Promise.all([
          fetchBlogPosts(merchant.id),
          fetchMerchantAgentStatus(merchant.id),
        ]);
        if (!isMountedRef.current) return;
        setAllPosts(posts);
        setAgent(agentStatus);
      } catch (error) {
        console.error(error);
      } finally {
        if (isMountedRef.current) {
          setIsRefreshing(false);
        }
      }
    };

    void refreshData();
  };

  // Optimistic Client-Side Filtering
  const filteredPosts =
    activeTab === 'all'
      ? allPosts
      : allPosts.filter((post) => post.status === activeTab);

  const StatusBadge = ({ status }: { status: string }) => {
    const isPublished = status === 'published';
    return (
      <View
        style={[
          styles.badge,
          {
            backgroundColor: isPublished
              ? colors.successLight
              : colors.warningLight,
          },
        ]}
      >
        <Text
          style={[
            styles.badgeText,
            { color: isPublished ? colors.success : colors.warning },
          ]}
        >
          {status === 'published' ? 'Published' : 'Draft'}
        </Text>
      </View>
    );
  };

  const AgentCard = () => {
    if (agentLoading) return null;
    if (!agent)
      return (
        <View
          style={[
            styles.agentCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.agentIconPlaceholder}>
            <Ionicons
              name="hardware-chip-outline"
              size={24}
              color={colors.textMuted}
            />
          </View>
          <View>
            <Text style={[styles.agentTitle, { color: colors.text }]}>
              No AI Agent Active
            </Text>
            <Text style={[styles.agentSubtitle, { color: colors.textMuted }]}>
              Contact support to enable autopilot.
            </Text>
          </View>
        </View>
      );

    const isActive = agent.status === 'active';
    return (
      <View
        style={[
          styles.agentCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View
          style={[
            styles.agentIcon,
            {
              backgroundColor: isActive
                ? colors.successLight
                : colors.errorLight,
            },
          ]}
        >
          <Ionicons
            name="sparkles"
            size={20}
            color={isActive ? colors.success : colors.error}
          />
        </View>
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={[styles.agentTitle, { color: colors.text }]}>
              {isActive ? 'Agent Active' : 'Agent Paused'}
            </Text>
            <View
              style={[
                styles.dot,
                { backgroundColor: isActive ? colors.success : colors.error },
              ]}
            />
          </View>
          <Text style={[styles.agentSubtitle, { color: colors.textSecondary }]}>
            Autopilot ON • Last checked{' '}
            {formatDistanceToNow(new Date(agent.last_run_at || Date.now()), {
              addSuffix: true,
            })}
          </Text>
        </View>
      </View>
    );
  };

  const renderItem = ({ item }: { item: BlogPost }) => (
    <Pressable
      style={[
        styles.postCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      onPress={() => router.push(`/blog/${item.id}`)}
    >
      <View style={styles.row}>
        {item.featured_image_url ? (
          <SafeImage
            source={{ uri: item.featured_image_url }}
            style={styles.thumbnail}
          />
        ) : (
          <View
            style={[
              styles.thumbnailPlaceholder,
              { backgroundColor: colors.background },
            ]}
          >
            <Ionicons name="image-outline" size={24} color={colors.textMuted} />
          </View>
        )}

        <View style={styles.postContent}>
          <Text
            numberOfLines={2}
            style={[styles.postTitle, { color: colors.text }]}
          >
            {item.title}
          </Text>

          <View style={styles.metaRow}>
            <StatusBadge status={item.status} />
            <Text style={[styles.dateText, { color: colors.textMuted }]}>
              {formatDistanceToNow(new Date(item.created_at), {
                addSuffix: true,
              })}
            </Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Blog Manager
        </Text>
        <Pressable
          onPress={() => router.push('/blog/new')}
          style={styles.addButton}
        >
          <Ionicons name="add" size={24} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <AgentCard />

        {/* Tabs */}
        <View
          style={[
            styles.tabs,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {(['all', 'draft', 'published'] as Tab[]).map((tab) => (
            <Pressable
              key={tab}
              style={[
                styles.tab,
                activeTab === tab && {
                  backgroundColor: isDark
                    ? colors.background
                    : colors.primaryLight,
                },
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      activeTab === tab ? colors.primary : colors.textSecondary,
                    fontFamily:
                      activeTab === tab
                        ? TYPOGRAPHY.fontFamily.semiBold
                        : TYPOGRAPHY.fontFamily.medium,
                  },
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* List */}
        {isLoading && !isRefreshing ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={{ marginTop: 40 }}
          />
        ) : (
          <FlatList
            data={filteredPosts}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons
                  name="newspaper-outline"
                  size={48}
                  color={colors.textMuted}
                />
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  No posts found
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  backButton: { padding: 4 },
  addButton: { padding: 4 },
  headerTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  content: { flex: 1 },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: 40,
  },

  // Agent Card
  agentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: SPACING.lg,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.md,
  },
  agentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentIconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
  },
  agentTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    marginBottom: 2,
  },
  agentSubtitle: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Tabs
  tabs: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.sm,
    padding: 4,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
  },
  tabText: {
    fontSize: TYPOGRAPHY.size.sm,
  },

  // Post Card
  postCard: {
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    ...SHADOWS.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.md,
    backgroundColor: '#eee',
  },
  thumbnailPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postContent: {
    flex: 1,
    justifyContent: 'center',
  },
  postTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    marginBottom: 6,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  dateText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    textTransform: 'uppercase',
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: SPACING.md,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
});
