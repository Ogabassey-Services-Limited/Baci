/**
 * Domains Dashboard Listing
 * 2026 Refactor: Full native management
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
// import { useAuth } from '@/hooks/useAuth';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DomainOptionsSheet from '@/components/domains/DomainOptionsSheet';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase'; // Access direct if possible, or use API

interface Domain {
  id: string;
  domain: string;
  is_primary: boolean;
  status: 'active' | 'pending' | 'failed' | 'verifying';
  created_at: string;
  domain_type: 'subdomain' | 'custom' | 'purchased';
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://baci.app/api';

export default function DomainsDashboard() {
  const { colors, shadows, isDark } = useTheme(); // Keep useTheme for general color usage
  // const { user } = useAuth();
  const {
    merchant,
    // storeUrl,
    primaryDomain: merchantPrimaryDomain,
  } = useMerchant();
  const router = useRouter();
  // 2026 UX Tip: Seed initial domains from useMerchant to prevent the "empty -> loading -> data" flash
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Sync merchant domains if we have them but local state is empty
  useEffect(() => {
    if (merchantPrimaryDomain && domains.length === 0) {
      setDomains([merchantPrimaryDomain as unknown as Domain]);
      setLoading(false); // We have at least one domain, we can show the list immediately
    }
  }, [merchantPrimaryDomain, domains.length]);

  const [actionLoading, setActionLoading] = useState(false);

  // Options Sheet State
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [optionsVisible, setOptionsVisible] = useState(false);

  const fetchDomains = useCallback(async () => {
    if (!merchant?.id) {
      // Only stop loading if we don't have a merchant yet
      if (!merchantPrimaryDomain) setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('domains')
        .select('*')
        .eq('merchant_id', merchant.id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDomains(data || []);
    } catch (error) {
      console.error('Error fetching domains:', error);
      Alert.alert('Error', 'Failed to load domains');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [merchant?.id, merchantPrimaryDomain]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchDomains();
  }, [fetchDomains]);

  const handleSetPrimary = async (domain: Domain) => {
    if (domain.status !== 'active') {
      Alert.alert(
        'Action Failed',
        'Only active domains can be set as primary.'
      );
      return;
    }

    setActionLoading(true);
    try {
      // 1. Update this domain to be primary (Database trigger handles unsetting others)
      const { error } = await supabase
        .from('domains')
        .update({ is_primary: true })
        .eq('id', domain.id);

      if (error) throw error;

      Alert.alert('Success', `${domain.domain} is now your primary domain.`);
      fetchDomains(); // Refresh list
    } catch (error) {
      console.error('Set primary error:', error);
      Alert.alert('Error', 'Failed to set primary domain. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = (domain: Domain) => {
    Alert.alert(
      'Delete Domain?',
      `Are you sure you want to delete ${domain.domain}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              // Get session for API auth
              const {
                data: { session },
              } = await supabase.auth.getSession();
              if (!session?.access_token) throw new Error('No session');

              const response = await fetch(
                `${API_URL}/domains/${encodeURIComponent(domain.domain)}`,
                {
                  method: 'DELETE',
                  headers: {
                    Authorization: `Bearer ${session.access_token}`,
                  },
                }
              );

              if (response.ok) {
                Alert.alert('Deleted', 'Domain has been removed.');
                fetchDomains();
              } else {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to delete');
              }
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert(
                'Error',
                error instanceof Error
                  ? error.message
                  : 'Failed to delete domain'
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleVerify = async (domain: Domain) => {
    setActionLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('No session');

      const response = await fetch(
        `${API_URL}/domains/${encodeURIComponent(domain.domain)}/verify`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        Alert.alert('Success', 'Domain verified successfully!');
        fetchDomains();
      } else {
        Alert.alert(
          'Verification Failed',
          data.error || 'Could not verify domain.'
        );
      }
    } catch (error) {
      console.error('Verify error:', error);
      Alert.alert('Error', 'Failed to verify domain.');
    } finally {
      setActionLoading(false);
    }
  };

  const openDomainUrl = (domain: string) => {
    const url = `https://${domain}`;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open this URL');
      }
    });
  };

  const handleOpenOptions = (domain: Domain) => {
    setSelectedDomain(domain);
    setOptionsVisible(true);
  };

  const handleOptionAction = (
    action: 'visit' | 'verify' | 'set_primary' | 'delete',
    domain: Domain
  ) => {
    if (action === 'visit') openDomainUrl(domain.domain);
    if (action === 'verify') handleVerify(domain);
    if (action === 'set_primary') handleSetPrimary(domain);
    if (action === 'delete') handleDelete(domain);
  };

  const renderDomainItem = (domain: Domain) => (
    <View
      key={domain.id}
      style={[styles.domainCard, { backgroundColor: colors.card }, shadows.sm]}
    >
      <View style={styles.domainInfo}>
        <View style={styles.domainHeader}>
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor:
                  domain.status === 'active'
                    ? colors.successLight
                    : domain.status === 'failed'
                      ? colors.errorLight
                      : colors.warningLight,
              },
            ]}
          >
            <Ionicons
              name="globe-outline"
              size={24}
              color={
                domain.status === 'active'
                  ? colors.success
                  : domain.status === 'failed'
                    ? colors.error
                    : colors.warning
              }
            />
          </View>

          <View>
            <Text style={[styles.domainName, { color: colors.text }]}>
              {domain.domain}
            </Text>
            <View style={styles.badgesRow}>
              {domain.is_primary && (
                <View
                  style={[
                    styles.primaryBadge,
                    { backgroundColor: colors.primaryLight },
                  ]}
                >
                  <Text
                    style={[styles.primaryBadgeText, { color: colors.primary }]}
                  >
                    Primary
                  </Text>
                </View>
              )}
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      domain.status === 'active'
                        ? colors.successLight
                        : domain.status === 'failed'
                          ? colors.errorLight
                          : colors.warningLight,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        domain.status === 'active'
                          ? colors.success
                          : domain.status === 'failed'
                            ? colors.error
                            : colors.warning,
                    },
                  ]}
                >
                  {domain.status.charAt(0).toUpperCase() +
                    domain.status.slice(1)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Options Button */}
      <TouchableOpacity
        style={styles.optionsButton}
        onPress={() => handleOpenOptions(domain)}
        disabled={actionLoading}
      >
        <Ionicons
          name="ellipsis-vertical"
          size={20}
          color={colors.textSecondary}
        />
      </TouchableOpacity>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top']}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backButton, { backgroundColor: colors.card }]}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Domains
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {/* Store Link Card */}
          <View
            style={[
              styles.storeCard,
              { backgroundColor: colors.card },
              shadows.sm,
            ]}
          >
            <View
              style={[
                styles.storeIcon,
                { backgroundColor: colors.primaryLight },
              ]}
            >
              <Ionicons name="storefront" size={28} color={colors.primary} />
            </View>
            <View style={styles.storeInfo}>
              <Text style={[styles.storeLabel, { color: colors.text }]}>
                Baci Store Link
              </Text>
              <Text style={[styles.storeUrl, { color: colors.textSecondary }]}>
                {merchantPrimaryDomain?.domain ||
                  (merchant?.slug
                    ? `${merchant.slug}.usebaci.com`
                    : 'Loading...')}
              </Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            CUSTOM DOMAINS
          </Text>

          {loading ? (
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading domains...
            </Text>
          ) : domains.filter((d) => d.domain_type !== 'subdomain').length ===
            0 ? (
            <View style={styles.promoContainer}>
              <View
                style={[styles.promoCard, { backgroundColor: colors.card }]}
              >
                <View
                  style={[
                    styles.promoIconCircle,
                    { backgroundColor: `${colors.primary}15` },
                  ]}
                >
                  <Ionicons name="rocket" size={32} color={colors.primary} />
                </View>
                <Text style={[styles.promoTitle, { color: colors.text }]}>
                  Claim your brand online
                </Text>
                <Text
                  style={[styles.promoText, { color: colors.textSecondary }]}
                >
                  Merchants with custom domains (e.g. .com) establish more trust
                  and look more professional to customers.
                </Text>

                <TouchableOpacity
                  style={[
                    styles.buyButton,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={() => router.push('/domains/buy')}
                >
                  <Text style={styles.buyButtonText}>Get a Custom Domain</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.connectLink}
                  onPress={() => router.push('/domains/connect')}
                >
                  <Text
                    style={[styles.connectLinkText, { color: colors.primary }]}
                  >
                    I already own a domain
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.domainsList}>
              {domains
                .filter((d) => d.domain_type !== 'subdomain')
                .map(renderDomainItem)}
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Add FAB */}
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }, shadows.lg]}
          onPress={() => router.push('/domains/add')}
        >
          <Ionicons name="add" size={32} color="#FFF" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Custom Options Sheet */}
      <DomainOptionsSheet
        visible={optionsVisible}
        domain={selectedDomain}
        onClose={() => setOptionsVisible(false)}
        onAction={handleOptionAction}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  storeInfo: {
    marginLeft: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.lg,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: 100,
  },
  storeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.xl,
  },
  storeIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  storeLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.sm,
    marginBottom: 2,
  },
  storeUrl: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
  },
  sectionTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.xs,
    marginBottom: SPACING.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: SPACING.xl,
  },
  emptyState: {
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyText: {},
  domainsList: {
    gap: SPACING.md,
  },
  domainCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  domainInfo: {
    flex: 1,
  },
  domainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  domainName: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.md,
    marginBottom: 4,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  optionsButton: {
    padding: SPACING.sm,
  },
  fab: {
    position: 'absolute',
    bottom: SPACING.xl,
    right: SPACING.xl,
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  promoContainer: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  promoCard: {
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  promoIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  promoTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.lg,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  promoText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 22,
    paddingHorizontal: SPACING.md,
  },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: RADIUS.full,
    width: '100%',
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  buyButtonText: {
    color: '#FFF',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.md,
    marginRight: 8,
  },
  connectLink: {
    paddingVertical: 8,
  },
  connectLinkText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
  },
});
