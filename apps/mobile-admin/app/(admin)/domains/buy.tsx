/**
 * Domain Search & Buy Screen
 * Real-time availability checks and native purchase flow
 */

import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { styles } from '@/components/domains/buy-domain.styles';
import { DomainSearchResultCard } from '@/components/domains/DomainSearchResultCard';
import type { DomainSearchResult } from '@/components/domains/domain-search-result';
import { AppFormScreen } from '@/components/ui/AppFormScreen';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

// Construct API URL safely
const getApiUrl = () => {
  // FORCE Production URL for reliability as local IP in .env is often unreachable
  const base = 'https://usebaci.com';
  if (__DEV__) {
    console.log(`[Diagnostic] Base API URL forced to: "${base}"`);
  }
  const url = base.startsWith('http') ? base : `https://${base}`;
  const final = url.endsWith('/api') ? url : `${url.replace(/\/$/, '')}/api`;
  if (__DEV__) {
    console.log(`[Diagnostic] Final computed API URL: "${final}"`);
  }
  return final;
};

const API_URL = getApiUrl();

function getPaymentInitializationErrorMessage(
  response: Response,
  rawBody: string
): string {
  const fallbackMessage = `Payment initialization failed (${response.status})`;

  if (!rawBody) {
    return fallbackMessage;
  }

  try {
    const parsed = JSON.parse(rawBody) as { error?: string; message?: string };
    const details =
      typeof parsed.error === 'string'
        ? parsed.error
        : typeof parsed.message === 'string'
          ? parsed.message
          : rawBody;

    return `${fallbackMessage}: ${details}`;
  } catch {
    return `${fallbackMessage}: ${rawBody}`;
  }
}

export default function BuyDomainScreen() {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DomainSearchResult[]>([]);
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
    setResults([]);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) throw new Error('You must be signed in to search domains');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(`${API_URL}/domains/check-availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ searchTerm: cleanQuery }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const err = await response
          .json()
          .catch(() => ({ error: 'Search failed' }));
        throw new Error(err.error || `Server error (${response.status})`);
      }

      const data = await response.json();
      setResults(
        (data.results || []).map((result: DomainSearchResult) => ({
          domain: result.domain,
          available: result.available,
          price: result.price,
          currency: 'NGN',
          popular: result.popular,
        }))
      );
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
        Alert.alert(
          'Search Failed',
          __DEV__ ? rawMessage : 'Please try again in a moment.'
        );
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
      if (!session) {
        throw new Error('You must be signed in to buy domains');
      }

      const response = await fetch(`${API_URL}/domains/initialize-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          domain,
          years: 1,
          callback_url: 'baciadmin://domains',
        }),
      });

      if (!response.ok) {
        const rawErrorBody = await response.text().catch(() => '');
        throw new Error(
          getPaymentInitializationErrorMessage(response, rawErrorBody)
        );
      }

      const data = (await response.json()) as {
        authorization_url?: string;
      };
      if (!data.authorization_url) {
        throw new Error('Payment initialization failed');
      }

      await WebBrowser.openBrowserAsync(data.authorization_url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        controlsColor: colors.primary,
        toolbarColor: colors.card,
      });
    } catch (error: unknown) {
      Alert.alert(
        'Purchase Failed',
        error instanceof Error ? error.message : 'An unexpected error occurred'
      );
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <AppFormScreen
      scrollEnabled={false}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <View style={styles.container}>
        <View
          style={[styles.searchContainer, { backgroundColor: colors.card }]}
        >
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            accessibilityLabel="Search domain"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            placeholder="Search domain (e.g. mybrand.com)"
            placeholderTextColor={colors.textSecondary}
            returnKeyType="search"
            style={[styles.input, { color: colors.text }]}
            value={query}
          />
          {query.length > 0 ? (
            <Pressable
              accessibilityLabel="Clear domain search"
              onPress={() => setQuery('')}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Checking availability...
            </Text>
          </View>
        ) : (
          <FlashList
            contentContainerStyle={styles.resultsContent}
            data={results}
            keyExtractor={(item) => item.domain}
            ListEmptyComponent={
              results.length === 0 && query.length > 0 ? (
                <Text
                  style={[
                    styles.emptyStateText,
                    { color: colors.textSecondary },
                  ]}
                >
                  No results found.
                </Text>
              ) : null
            }
            renderItem={({ item }) => (
              <DomainSearchResultCard
                domain={item}
                isPurchasing={purchasing === item.domain}
                onBuy={() => handleBuy(item.domain, item.price)}
              />
            )}
          />
        )}
      </View>
    </AppFormScreen>
  );
}
