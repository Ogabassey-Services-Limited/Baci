import Ionicons from '@react-native-vector-icons/ionicons';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
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
import { FeatureGateScreen } from '@/components/billing/FeatureGateScreen';
import { styles } from '@/components/domains/buy-domain.styles';
import { DomainSearchResultCard } from '@/components/domains/DomainSearchResultCard';
import {
  API_URL,
  DomainUpgradeRequiredError,
  extractErrorCode,
  getPaymentInitializationErrorMessage,
  isUpgradeRequiredResponse,
} from '@/components/domains/domain-api-helpers';
import type { DomainSearchResult } from '@/components/domains/domain-search-result';
import { performDomainSearch } from '@/components/domains/perform-domain-search';
import { AppFormScreen } from '@/components/ui/AppFormScreen';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

async function openDomainPurchase(
  domain: string,
  browserColors: { controlsColor: string; toolbarColor: string }
): Promise<void> {
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
    const message = getPaymentInitializationErrorMessage(
      response,
      rawErrorBody
    );
    // A plan gate (402 / requires_upgrade) is not a payment failure — surface
    // it as an upgrade path instead of a dead "Purchase Failed" dialog.
    if (
      isUpgradeRequiredResponse(response.status, extractErrorCode(rawErrorBody))
    ) {
      throw new DomainUpgradeRequiredError(message);
    }
    throw new Error(message);
  }

  const data = (await response.json()) as {
    authorization_url?: string;
  };
  if (!data.authorization_url) {
    throw new Error('Payment initialization failed');
  }

  await WebBrowser.openBrowserAsync(data.authorization_url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    controlsColor: browserColors.controlsColor,
    toolbarColor: browserColors.toolbarColor,
  });
}

export default function BuyDomainScreen() {
  const { colors } = useTheme();
  const router = useRouter();
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

    await performDomainSearch(cleanQuery, {
      activeSearchControllerRef,
      activeSearchRequestIdRef,
      latestQueryRef,
      setLastLookupSucceeded,
      setLoading,
      setResults,
    });
  };

  const handleBuy = async (domain: string, _price: number) => {
    setPurchasing(domain);

    try {
      await openDomainPurchase(domain, {
        controlsColor: colors.primary,
        toolbarColor: colors.card,
      });
    } catch (error: unknown) {
      if (error instanceof DomainUpgradeRequiredError) {
        Alert.alert('Upgrade required', error.message, [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Upgrade',
            onPress: () => router.push('/(admin)/subscribe'),
          },
        ]);
      } else {
        Alert.alert(
          'Purchase Failed',
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred'
        );
      }
    }
    setPurchasing(null);
  };

  return (
    <FeatureGateScreen
      description="Search, register, and activate branded domains when Baci Pro is active."
      feature="custom_domain"
      serverEntitlementRequired
      title="Custom domains are a Baci Pro feature"
    >
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
              <Text
                style={[styles.loadingText, { color: colors.textSecondary }]}
              >
                Checking availability…
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
    </FeatureGateScreen>
  );
}
