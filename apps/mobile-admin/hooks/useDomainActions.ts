import { useState } from 'react';
import { Alert, Linking } from 'react-native';
import type { Domain, DomainAction } from '@/components/domains/domain-types';
import { supabase } from '@/lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://baci.app/api';

interface UseDomainActionsParams {
  merchantId: string | undefined;
  onRefresh: () => void;
}

export function useDomainActions({
  merchantId,
  onRefresh,
}: UseDomainActionsParams) {
  const [actionLoading, setActionLoading] = useState(false);

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
      const { error } = await supabase
        .from('domains')
        .update({ is_primary: true })
        .eq('id', domain.id);

      if (error) throw error;

      Alert.alert('Success', `${domain.domain} is now your primary domain.`);
      onRefresh();
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
        onRefresh();
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

  const handleOptionAction = (action: DomainAction, domain: Domain) => {
    if (action === 'visit') openDomainUrl(domain.domain);
    if (action === 'verify') handleVerify(domain);
    if (action === 'set_primary') handleSetPrimary(domain);
    if (action === 'delete') handleDelete(domain);
  };

  return {
    actionLoading,
    handleOptionAction,
  };
}
