import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Customer } from '@/stores/auth-store';

type AccountLoyaltyChannel = ReturnType<typeof supabase.channel>;

const ACCOUNT_LOYALTY_CHANNEL_PREFIX = 'account-loyalty';

function createAccountLoyaltyChannelName(customerId: string) {
  return `${ACCOUNT_LOYALTY_CHANNEL_PREFIX}-${customerId}`;
}

function isAccountLoyaltyChannel(
  channel: AccountLoyaltyChannel,
  channelName: string
) {
  return channel.topic === channelName || channel.topic === `realtime:${channelName}`;
}

async function removeExistingAccountLoyaltyChannels(channelName: string) {
  const existingChannels = supabase
    .getChannels()
    .filter((channel) => isAccountLoyaltyChannel(channel, channelName));

  await Promise.all(
    existingChannels.map((channel) => supabase.removeChannel(channel))
  );
}

export function useAccountLoyaltyPoints(
  customer: Customer | null,
  isFocused: boolean
) {
  const [loyaltyPoints, setLoyaltyPoints] = useState<number | undefined>(
    customer?.loyalty_points
  );

  useEffect(() => {
    setLoyaltyPoints(customer?.loyalty_points);
  }, [customer?.loyalty_points]);

  useEffect(() => {
    if (!(isFocused && customer?.id)) {
      return;
    }

    let isMounted = true;
    let channel: AccountLoyaltyChannel | null = null;

    const refreshLoyaltyPoints = async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('loyalty_points')
        .eq('id', customer.id)
        .maybeSingle();

      if (error) {
        console.error('Failed to refresh loyalty points:', error);
        return;
      }

      if (isMounted && typeof data?.loyalty_points === 'number') {
        setLoyaltyPoints(data.loyalty_points);
      }
    };

    const subscribeToLoyaltyUpdates = async () => {
      const channelName = createAccountLoyaltyChannelName(customer.id);

      try {
        await removeExistingAccountLoyaltyChannels(channelName);
      } catch (err) {
        console.error('Realtime channel cleanup error:', err);
      }

      if (!isMounted) {
        return;
      }

      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'customers',
            filter: `id=eq.${customer.id}`,
          },
          (payload) => {
            if (isMounted && payload.new && 'loyalty_points' in payload.new) {
              setLoyaltyPoints(payload.new.loyalty_points as number);
            }
          }
        )
        .subscribe((_status, err) => {
          if (err) {
            console.error('Realtime subscription error:', err);
          }
        });

      await refreshLoyaltyPoints();
    };

    void subscribeToLoyaltyUpdates();

    return () => {
      isMounted = false;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [isFocused, customer?.id]);

  return loyaltyPoints;
}
