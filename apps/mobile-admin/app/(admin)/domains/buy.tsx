import Ionicons from "@react-native-vector-icons/ionicons/static";
import { FlashList } from '@shopify/flash-list';
import * as WebBrowser from 'expo-web-browser';
import { useRef, useState } from 'react';
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
import {
  API_URL,
  getPaymentInitializationErrorMessage,
  normalizeDomainSearchResults,
} from '@/components/domains/domain-api-helpers';
import type { DomainSearchResult } from '@/components/domains/domain-search-result';
import { AppFormScreen } from '@/components/ui/AppFormScreen';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

export default function BuyDomainScreen() {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastLookupSucceeded, setLastLookupSucceeded] = useState<
    boolean | null
  >(null);
  const [results, setResults] = useState<DomainSearchResult[]>([]);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const activeSearchControllerRef = useRef<AbortController | null>(null);
  const activeSearchRequestIdRef = useRef(0);
  const latestQueryRef = useRef('');

  const handleQueryChange = (nextQuery: string) => {
    const normalizedNextQuery = nextQuery.trim().toLowerCase();

    latestQueryRef.current = nextQuery;
    setQuery(nextQuery);

    if (activeSearchControllerRef.current) {
      activeSearchRequestIdRef.current += 1;
      activeSearchControllerRef.current.abort();
      activeSearchControllerRef.current = null;
      setLoading(false);
    }

    if (!normalizedNextQuery) {
      setResults([]);
      setLastLookupSucceeded(null);
    }
  };

  const handleSearch = async () => {
    const cleanQuery = (latestQueryRef.current || query).trim().toLowerCase();
    let controller: AbortController | null = null;
    let didTimeout = false;
    let requestId = 0;

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
    setLastLookupSucceeded(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) throw new Error('You must be signed in to search domains');

      activeSearchControllerRef.current?.abort();
      const nextController = new AbortController();
      controller = nextController;
      requestId = activeSearchRequestIdRef.current + 1;
      activeSearchControllerRef.current = nextController;
      activeSearchRequestIdRef.current = requestId;
      const timeoutId = setTimeout(() => {
        didTimeout = true;
        nextController.abort();
      }, 20000);

      const response = await fetch(`${API_URL}/domains/check-availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ searchTerm: cleanQuery }),
        signal: nextController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const err = await response
          .json()
          .catch(() => ({ error: 'Search failed' }));
        throw new Error(err.error || `Server error (${response.status})`);
      }

      const data = await response.json();
      const nextResults = normalizeDomainSearchResults(
        data.results || [],
        'NGN'
      );

      if (
        activeSearchRequestIdRef.current !== requestId ||
        latestQueryRef.current.trim().toLowerCase() !== cleanQuery
      ) {
        return;
      }

      setResults(nextResults);
      setLastLookupSucceeded(true);
    } catch (error: unknown) {
      console.error('[Diagnostic] Full search error:', error);
      const isCurrentRequest =
        requestId > 0 &&
        activeSearchRequestIdRef.current === requestId &&
        latestQueryRef.current.trim().toLowerCase() === cleanQuery;

      if (error instanceof Error && error.name === 'AbortError') {
        if (didTimeout) {
          setLastLookupSucceeded(false);
          Alert.alert(
            'Timeout',
            'Domain search took too long. Please try again.'
          );
        }
      } else {
        if (!isCurrentRequest) {
          return;
        }
        const rawMessage =
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred';
        setLastLookupSucceeded(false);
        Alert.alert(
          'Search Failed',
          __DEV__ ? rawMessage : 'Please try again in a moment.'
        );
      }
    } finally {
      if (activeSearchControllerRef.current?.signal === controller?.signal) {
        activeSearchControllerRef.current = null;
      }
      if (requestId > 0 && activeSearchRequestIdRef.current === requestId) {
        setLoading(false);
      }
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
            onChangeText={handleQueryChange}
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
              onPress={() => handleQueryChange('')}
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
              results.length === 0 &&
              query.length > 0 &&
              lastLookupSucceeded === true ? (
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
