/**
 * Domains Dashboard Listing
 * 2026 Refactor: Full native management
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DomainEmptyState } from '@/components/domains/DomainEmptyState';
import { DomainItemCard } from '@/components/domains/DomainItemCard';
import DomainOptionsSheet from '@/components/domains/DomainOptionsSheet';
import type { Domain } from '@/components/domains/domain-types';
import { StoreLinkCard } from '@/components/domains/StoreLinkCard';
import { SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useDomainActions } from '@/hooks/useDomainActions';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

type DomainStatus = Domain['status'];

const VALID_DOMAIN_STATUSES: ReadonlySet<DomainStatus> = new Set([
  'active',
  'pending',
  'failed',
  'verifying',
]);

const normalizeDomain = (domain: {
  id: string;
  domain: string;
  is_primary: boolean;
  status: string;
  domain_type: Domain['domain_type'];
  created_at?: string | null;
}): Domain => ({
  id: domain.id,
  domain: domain.domain,
  is_primary: domain.is_primary,
  status: VALID_DOMAIN_STATUSES.has(domain.status as DomainStatus)
    ? (domain.status as DomainStatus)
    : 'pending',
  created_at: domain.created_at ?? new Date(0).toISOString(),
  domain_type: domain.domain_type,
});

async function fetchMerchantDomains(merchantId: string): Promise<Domain[]> {
  const { data, error } = await supabase
    .from('domains')
    .select('id, domain, is_primary, status, created_at, domain_type')
    .eq('merchant_id', merchantId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(normalizeDomain);
}

export default function DomainsDashboard() {
  const { colors, shadows, isDark } = useTheme();
  const { merchant, primaryDomain: merchantPrimaryDomain } = useMerchant();
  const router = useRouter();
  const primaryDomainId = merchantPrimaryDomain?.id;
  const primaryDomainValue = merchantPrimaryDomain?.domain;
  const primaryDomainType = merchantPrimaryDomain?.domain_type;
  const primaryDomainIsPrimary = merchantPrimaryDomain?.is_primary;
  const primaryDomainStatus = merchantPrimaryDomain?.status;

  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [_fetchError, setFetchError] = useState<string | null>(null);

  // Options Sheet State
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [optionsVisible, setOptionsVisible] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadDomains = async () => {
      if (!merchant?.id) {
        if (isMounted) {
          const fallbackDomain =
            primaryDomainId &&
            primaryDomainValue &&
            primaryDomainType &&
            typeof primaryDomainIsPrimary === 'boolean' &&
            primaryDomainStatus
              ? normalizeDomain({
                  id: primaryDomainId,
                  domain: primaryDomainValue,
                  is_primary: primaryDomainIsPrimary,
                  status: primaryDomainStatus,
                  domain_type: primaryDomainType,
                })
              : null;
          setDomains(fallbackDomain ? [fallbackDomain] : []);
          setLoading(false);
        }
        return;
      }

      setFetchError(null);
      try {
        const fetchedDomains = await fetchMerchantDomains(merchant.id);
        if (!isMounted) return;
        setDomains(fetchedDomains);
      } catch (error) {
        console.error('Error fetching domains:', error);
        if (isMounted) {
          setFetchError('Failed to load domains');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    void loadDomains();

    return () => {
      isMounted = false;
    };
  }, [
    merchant?.id,
    primaryDomainId,
    primaryDomainValue,
    primaryDomainType,
    primaryDomainIsPrimary,
    primaryDomainStatus,
  ]);

  const refreshDomains = async () => {
    setRefreshing(true);
    setFetchError(null);

    if (!merchant?.id) {
      setRefreshing(false);
      return;
    }

    try {
      const fetchedDomains = await fetchMerchantDomains(merchant.id);
      setDomains(fetchedDomains);
    } catch (error) {
      console.error('Error fetching domains:', error);
      setFetchError('Failed to load domains');
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    void refreshDomains();
  };

  const { actionLoading, handleOptionAction } = useDomainActions({
    onRefresh: refreshDomains,
  });

  const handleOpenOptions = (domain: Domain) => {
    setSelectedDomain(domain);
    setOptionsVisible(true);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SystemBars style={isDark ? 'light' : 'dark'} />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top']}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backButton, { backgroundColor: colors.card }]}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
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
          <StoreLinkCard
            primaryDomain={merchantPrimaryDomain?.domain}
            merchantSlug={merchant?.slug || undefined}
          />

          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            CUSTOM DOMAINS
          </Text>

          {loading ? (
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading domains...
            </Text>
          ) : _fetchError ? (
            <Pressable
              style={[styles.errorCard, { backgroundColor: colors.errorLight }]}
              onPress={onRefresh}
            >
              <Ionicons name="alert-circle" size={20} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>
                {_fetchError}
              </Text>
              <Ionicons name="refresh" size={16} color={colors.error} />
            </Pressable>
          ) : domains.filter((d) => d.domain_type !== 'subdomain').length ===
            0 ? (
            <DomainEmptyState
              onBuyDomain={() => router.push('/domains/buy')}
              onConnectDomain={() => router.push('/domains/connect')}
            />
          ) : (
            <View style={styles.domainsList}>
              {domains
                .filter((d) => d.domain_type !== 'subdomain')
                .map((domain) => (
                  <DomainItemCard
                    key={domain.id}
                    domain={domain}
                    onOpenOptions={handleOpenOptions}
                    actionLoading={actionLoading}
                  />
                ))}
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Add FAB */}
        <Pressable
          style={[styles.fab, { backgroundColor: colors.primary }, shadows.lg]}
          onPress={() => router.push('/domains/add')}
        >
          <Ionicons name="add" size={32} color="#FFF" />
        </Pressable>
      </SafeAreaView>

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
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: 8,
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  domainsList: {
    gap: SPACING.md,
  },
  fab: {
    position: 'absolute',
    bottom: SPACING.xl,
    right: SPACING.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
});
