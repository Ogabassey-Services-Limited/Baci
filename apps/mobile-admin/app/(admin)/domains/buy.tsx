/**
 * Domain Search & Buy Screen
 * Real-time availability checks and native purchase flow
 */

import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
// import { useMerchant } from '@/hooks/useMerchant';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
// import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
// import {
//   DOMAIN_PRICING,
//   calculateDomainPrice,
// } from '@/constants/domain-pricing';
import { supabase } from '@/lib/supabase';

// Construct API URL safely
const getApiUrl = () => {
  // FORCE Production URL for reliability as local IP in .env is often unreachable
  const base = 'https://usebaci.com';
  if (__DEV__) {
    console.log(`[Diagnostic] Base API URL forced to: "${base}"`);
  }
  // Ensure it has protocol
  const url = base.startsWith('http') ? base : `https://${base}`;
  // Ensure it ends with /api but not /api/
  const final = url.endsWith('/api') ? url : `${url.replace(/\/$/, '')}/api`;
  if (__DEV__) {
    console.log(`[Diagnostic] Final computed API URL: "${final}"`);
  }
  return final;
};

const API_URL = getApiUrl();

interface SearchResult {
  domain: string;
  available: boolean;
  price: number;
  currency: string;
  popular?: boolean;
}

export default function BuyDomainScreen() {
  const { colors, shadows } = useTheme();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const handleSearch = async () => {
    const cleanQuery = query.trim().toLowerCase();
    if (__DEV__) {
      console.log(`[Diagnostic] User search query: "${cleanQuery}"`);
    }

    if (!cleanQuery) return;

    if (!cleanQuery.includes('.')) {
      Alert.alert(
        'Invalid Domain',
        'Please enter a valid domain (e.g. mystore.com)'
      );
      return;
    }

    setLoading(true);
    setResults([]); // Clear previous results
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) throw new Error('You must be signed in to search domains');
      if (__DEV__) {
        console.log(
          `[Diagnostic] Auth session token present: ${!!session.access_token}`
        );
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        if (__DEV__) {
          console.log(
            `[Diagnostic] Reached 20s timeout for: ${API_URL}/domains/check-availability`
          );
        }
        controller.abort();
      }, 20000);

      const targetUrl = `${API_URL}/domains/check-availability`;
      if (__DEV__) {
        console.log(`[Diagnostic] Fetching: ${targetUrl}`);
      }

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ searchTerm: cleanQuery }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (__DEV__) {
        console.log(`[Diagnostic] Fetch response status: ${response.status}`);
      }

      if (!response.ok) {
        const err = await response
          .json()
          .catch(() => ({ error: 'Search failed' }));
        if (__DEV__) {
          console.log(`[Diagnostic] Fetch error body:`, err);
        }
        throw new Error(err.error || `Server error (${response.status})`);
      }

      const data = await response.json();
      if (__DEV__) {
        console.log(
          `[Diagnostic] Received ${data.results?.length || 0} results`
        );
      }

      const mappedResults = (data.results || []).map(
        (r: {
          domain: string;
          available: boolean;
          price: number;
          popular?: boolean;
        }) => ({
          domain: r.domain,
          available: r.available,
          price: r.price,
          currency: 'NGN',
          popular: r.popular,
        })
      );

      setResults(mappedResults);
    } catch (error: unknown) {
      console.error('[Diagnostic] Full search error:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        Alert.alert(
          'Timeout',
          'Domain search took too long. Please try again.'
        );
      } else {
        const rawMessage =
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred';
        const userMessage = __DEV__
          ? rawMessage
          : 'Please try again in a moment.';
        Alert.alert('Search Failed', userMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (domain: string, _price: number) => {
    setPurchasing(domain);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // 1. Initialize Payment
      const response = await fetch(`${API_URL}/domains/initialize-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          domain,
          years: 1,
          callback_url: 'baciadmin://domains',
        }),
      });

      const data = await response.json();
      if (!data.authorization_url)
        throw new Error('Payment initialization failed');

      // 2. Open Web Browser for Payment (No "Sign In" prompt)
      await WebBrowser.openBrowserAsync(data.authorization_url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        controlsColor: colors.primary,
        toolbarColor: colors.card,
      });

      // Note: We don't get a 'success' callback from openBrowserAsync like we do with AuthSession
      // We assume user completed or cancelled when they close the browser.
      setPurchasing(null);
    } catch (error: unknown) {
      Alert.alert(
        'Purchase Failed',
        error instanceof Error ? error.message : 'An unexpected error occurred'
      );
    } finally {
      setPurchasing(null);
    }
  };

  const renderItem = ({ item }: { item: SearchResult }) => (
    <View
      style={[
        styles.resultCard,
        { backgroundColor: colors.card, borderColor: colors.border },
        shadows.sm,
      ]}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[styles.domainName, { color: colors.text }]}>
            {item.domain}
          </Text>
          {item.popular && (
            <View
              style={{
                backgroundColor: colors.primary,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
              }}
            >
              <Text
                style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}
              >
                POPULAR
              </Text>
            </View>
          )}
        </View>

        {item.available ? (
          <Text
            style={{
              color: colors.success,
              fontSize: 13,
              marginTop: 4,
              fontFamily: TYPOGRAPHY.fontFamily.medium,
            }}
          >
            Available
          </Text>
        ) : (
          <Text
            style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}
          >
            Unavailable
          </Text>
        )}
      </View>

      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.price, { color: colors.text }]}>
          ₦{item.price.toLocaleString()}
        </Text>
        {item.available && (
          <Pressable
            style={[
              styles.buyButton,
              {
                backgroundColor: colors.primary,
                opacity: purchasing ? 0.5 : 1,
              },
            ]}
            onPress={() => handleBuy(item.domain, item.price)}
            disabled={!!purchasing}
          >
            {purchasing === item.domain ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.buyText}>Buy</Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View
          style={[styles.searchContainer, { backgroundColor: colors.card }]}
        >
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Search domain (e.g. mybrand.com)"
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')}>
              <Ionicons
                name="close-circle"
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>
          )}
        </View>

        {loading ? (
          <View style={{ padding: 40 }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text
              style={{
                textAlign: 'center',
                marginTop: 20,
                color: colors.textSecondary,
              }}
            >
              Checking availability...
            </Text>
          </View>
        ) : (
          <FlashList
            data={results}
            renderItem={renderItem}
            keyExtractor={(item) => item.domain}
            estimatedItemSize={60}
            contentContainerStyle={{ padding: SPACING.md }}
            ListEmptyComponent={
              results.length === 0 && query.length > 0 ? (
                <Text
                  style={{
                    textAlign: 'center',
                    marginTop: 40,
                    color: colors.textSecondary,
                  }}
                >
                  No results found.
                </Text>
              ) : null
            }
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    margin: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  resultCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  domainName: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  price: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: 8,
  },
  buyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    minWidth: 70,
    alignItems: 'center',
  },
  buyText: {
    color: 'white',
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
});
