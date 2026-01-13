/**
 * Domain Search & Buy Screen
 * Real-time availability checks and native purchase flow
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  FlatList,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
// import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/constants/theme';
// import { useMerchant } from '@/hooks/useMerchant';
import * as WebBrowser from 'expo-web-browser';
// import {
//   DOMAIN_PRICING,
//   calculateDomainPrice,
// } from '@/constants/domain-pricing';
import { supabase } from '@/lib/supabase';

// Mock API URL - Replace with actual Production URL
// Use Environment Variable or Fallback
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://baci.app/api';

interface SearchResult {
  domain: string;
  available: boolean;
  price: number;
  currency: string;
  popular?: boolean;
}

export default function BuyDomainScreen() {
  const { colors, shadows } = useTheme();
  // const { merchant } = useMerchant();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.includes('.')) {
      // Simple validation
      Alert.alert(
        'Invalid Domain',
        'Please enter a valid domain (e.g. mystore.com)'
      );
      return;
    }

    setLoading(true);
    try {
      // Get Session for Auth Header
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Setup timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      // Call Next.js API
      const response = await fetch(`${API_URL}/domains/check-availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ searchTerm: query }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Search failed');
      }

      const data = await response.json();
      // Map API results to local interface just in case
      const mappedResults = (data.results || []).map((r: { domain: string; available: boolean; price: number; popular?: boolean }) => ({
        domain: r.domain,
        available: r.available,
        price: r.price, // API returns 'price' which is resale price
        currency: 'NGN',
        popular: r.popular,
      }));

      setResults(mappedResults);
    } catch (error: unknown) {
      if ((error as Error).name === 'AbortError') {
        Alert.alert('Timeout', 'Search took too long. Please try again.');
      } else {
        Alert.alert('Error', (error as Error).message);
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
      Alert.alert('Purchase Failed', (error as Error).message);
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
          <FlatList
            data={results}
            renderItem={renderItem}
            keyExtractor={(item) => item.domain}
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
