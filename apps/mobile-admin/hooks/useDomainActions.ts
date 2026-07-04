import { useState } from 'react';
import { Alert, Linking } from 'react-native';
// Shared helper guarantees the base URL ends in /api. A local
// `EXPO_PUBLIC_API_URL` fallback resolves to the bare origin (usebaci.com),
// so DELETE/POST would hit page routes and 405 (see domains connect fix).
import { API_URL } from '@/components/domains/domain-api-helpers';
import type { Domain, DomainAction } from '@/components/domains/domain-types';
import { useMerchant } from '@/hooks/useMerchant';
import { supabase } from '@/lib/supabase';

interface UseDomainActionsParams {
  onRefresh: () => void;
}

interface DomainActionContext {
  onRefresh: () => void;
  setActionLoading: (loading: boolean) => void;
}

async function readDomainErrorMessage(
  response: Response,
  fallback: string
): Promise<string> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const payload: unknown = await response.json();
      if (
        payload &&
        typeof payload === 'object' &&
        'error' in payload &&
        typeof payload.error === 'string'
      ) {
        return payload.error;
      }
    } catch {
      // Fall through to text/generic handling below.
    }
  }

  const text = await response.text().catch(() => '');
  return text.trim() || `${fallback} (${response.status})`;
}

// Module-scope helpers own the try/finally + throw control flow so the React
// Compiler can memoize the hook (try/finally bodies bail out compilation).
async function runSetPrimary(
  domain: Domain,
  merchantId: string,
  { onRefresh, setActionLoading }: DomainActionContext
): Promise<void> {
  setActionLoading(true);
  try {
    // Find the current primary domain for rollback
    const { data: currentPrimary } = await supabase
      .from('domains')
      .select('id')
      .eq('merchant_id', merchantId)
      .eq('is_primary', true)
      .maybeSingle();

    // Unset any existing primary domain scoped to this merchant
    const { error: unsetError } = await supabase
      .from('domains')
      .update({ is_primary: false })
      .eq('merchant_id', merchantId)
      .eq('is_primary', true);

    if (unsetError) throw unsetError;

    // Set the new primary
    const { error: setError } = await supabase
      .from('domains')
      .update({ is_primary: true })
      .eq('merchant_id', merchantId)
      .eq('id', domain.id);

    if (setError) {
      // Rollback: restore the original primary
      if (currentPrimary?.id) {
        await supabase
          .from('domains')
          .update({ is_primary: true })
          .eq('id', currentPrimary.id);
      }
      throw setError;
    }

    Alert.alert('Success', `${domain.domain} is now your primary domain.`);
    onRefresh();
  } catch (error) {
    console.error('Set primary error:', error);
    Alert.alert('Error', 'Failed to set primary domain. Please try again.');
  } finally {
    setActionLoading(false);
  }
}

async function runDelete(
  domain: Domain,
  { onRefresh, setActionLoading }: DomainActionContext
): Promise<void> {
  setActionLoading(true);
  try {
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
      onRefresh();
    } else {
      throw new Error(
        await readDomainErrorMessage(response, 'Failed to delete')
      );
    }
  } catch (error) {
    console.error('Delete error:', error);
    Alert.alert(
      'Error',
      error instanceof Error ? error.message : 'Failed to delete domain'
    );
  } finally {
    setActionLoading(false);
  }
}

async function runVerify(
  domain: Domain,
  { onRefresh, setActionLoading }: DomainActionContext
): Promise<void> {
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

    let data: { success?: boolean; error?: string } | null = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        // JSON parse failed — handled below
      }
    }

    if (response.ok && data?.success) {
      Alert.alert('Success', 'Domain verified successfully!');
      onRefresh();
    } else {
      const message =
        data?.error ||
        (await response.text().catch(() => '')) ||
        'Could not verify domain.';
      Alert.alert('Verification Failed', message);
    }
  } catch (error) {
    console.error('Verify error:', error);
    Alert.alert('Error', 'Failed to verify domain.');
  } finally {
    setActionLoading(false);
  }
}

export function useDomainActions({ onRefresh }: UseDomainActionsParams) {
  const { merchant } = useMerchant();
  const merchantId = merchant?.id;
  const [actionLoading, setActionLoading] = useState(false);

  const handleSetPrimary = async (domain: Domain) => {
    if (domain.status !== 'active') {
      Alert.alert(
        'Action Failed',
        'Only active domains can be set as primary.'
      );
      return;
    }

    if (!merchantId) {
      Alert.alert('Error', 'Merchant not loaded. Please try again.');
      return;
    }

    await runSetPrimary(domain, merchantId, { onRefresh, setActionLoading });
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
          onPress: () => runDelete(domain, { onRefresh, setActionLoading }),
        },
      ]
    );
  };

  const handleVerify = (domain: Domain) =>
    runVerify(domain, { onRefresh, setActionLoading });

  const openDomainUrl = async (domainName: string) => {
    const url = `https://${domainName}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open this URL');
      }
    } catch (error) {
      console.error('Open URL error:', error);
      Alert.alert(
        'Error',
        `Cannot open this URL${error instanceof Error ? `: ${error.message}` : ''}`
      );
    }
  };

  const handleOptionAction = (action: DomainAction, domain: Domain) => {
    switch (action) {
      case 'visit':
        openDomainUrl(domain.domain);
        break;
      case 'verify':
        handleVerify(domain);
        break;
      case 'set_primary':
        handleSetPrimary(domain);
        break;
      case 'delete':
        handleDelete(domain);
        break;
    }
  };

  return {
    actionLoading,
    handleOptionAction,
  };
}
