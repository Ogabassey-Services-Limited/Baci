/**
 * Domains Dashboard Listing
 * 2026 Refactor: Full native management
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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

export default function DomainsDashboard() {
  const { colors, shadows, isDark } = useTheme();
  const { merchant, primaryDomain: merchantPrimaryDomain } = useMerchant();
  const router = useRouter();

  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Options Sheet State
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [optionsVisible, setOptionsVisible] = useState(false);

  // Sync merchant domains if we have them but local state is empty
  useEffect(() => {
    if (merchantPrimaryDomain && domains.length === 0) {
      setDomains([merchantPrimaryDomain as unknown as Domain]);
      setLoading(false);
    }
  }, [merchantPrimaryDomain, domains.length]);

  const fetchDomains = async () => {
    if (!merchant?.id) {
      if (!merchantPrimaryDomain) setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('domains')
        .select('id, domain, is_primary, status, created_at, domain_type')
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
  };

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDomains();
  };

  const { actionLoading, handleOptionAction } = useDomainActions({
    onRefresh: fetchDomains,
  });

  const handleOpenOptions = (domain: Domain) => {
    setSelectedDomain(domain);
    setOptionsVisible(true);
  };

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
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }, shadows.lg]}
          onPress={() => router.push('/domains/add')}
        >
          <Ionicons name="add" size={32} color="#FFF" />
        </TouchableOpacity>
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
