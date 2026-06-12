import { Alert } from 'react-native';
import {
  API_URL,
  normalizeDomainSearchResults,
} from '@/components/domains/domain-api-helpers';
import type { DomainSearchResult } from '@/components/domains/domain-search-result';
import { supabase } from '@/lib/supabase';

export interface DomainSearchContext {
  activeSearchControllerRef: { current: AbortController | null };
  activeSearchRequestIdRef: { current: number };
  latestQueryRef: { current: string };
  setLastLookupSucceeded: (value: boolean | null) => void;
  setLoading: (loading: boolean) => void;
  setResults: (results: DomainSearchResult[]) => void;
}

export async function performDomainSearch(
  cleanQuery: string,
  context: DomainSearchContext
): Promise<void> {
  const {
    activeSearchControllerRef,
    activeSearchRequestIdRef,
    latestQueryRef,
    setLastLookupSucceeded,
    setLoading,
    setResults,
  } = context;
  let controller: AbortController | null = null;
  let didTimeout = false;
  let requestId = 0;

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
    const nextResults = normalizeDomainSearchResults(data.results || [], 'NGN');

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
        error instanceof Error ? error.message : 'An unexpected error occurred';
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
}
