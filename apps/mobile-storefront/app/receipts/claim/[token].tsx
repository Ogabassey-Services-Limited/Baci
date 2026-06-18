import Ionicons from '@react-native-vector-icons/ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StorefrontScreenShell } from '@/components/storefront/StorefrontScreenShell';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { EXPO_PUBLIC_API_URL } from '@/env';
import { useRequireAuth } from '@/hooks/use-auth-guard';
import { getSession } from '@/lib/supabase';

type ClaimStatus = 'loading' | 'claiming' | 'error';

function readToken(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildClaimApiUrl(token: string) {
  const baseUrl = EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  return `${baseUrl}/api/storefront/receipts/claims/${encodeURIComponent(token)}`;
}

async function readErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === 'string'
      ? body.error
      : 'We could not move this receipt into your app.';
  } catch {
    return 'We could not move this receipt into your app.';
  }
}

export default function ReceiptClaimScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = readToken(params.token);
  const { isLoading: isAuthLoading, redirectTo } = useRequireAuth();
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState('Moving your receipt into the app...');
  const [status, setStatus] = useState<ClaimStatus>('loading');

  useEffect(() => {
    let isActive = true;

    async function claimReceipt() {
      if (isAuthLoading || redirectTo) {
        return;
      }

      if (!token) {
        setStatus('error');
        setMessage('This receipt link is missing its claim token.');
        return;
      }

      setStatus('claiming');
      setMessage(
        attempt > 0 ? 'Trying again...' : 'Moving your receipt into the app...'
      );

      try {
        const session = await getSession();
        if (!session?.access_token) {
          if (!isActive) return;
          setStatus('error');
          setMessage('Please sign in again to claim this receipt.');
          return;
        }

        const response = await fetch(buildClaimApiUrl(token), {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          method: 'POST',
        });

        if (!isActive) return;

        if (!response.ok) {
          setStatus('error');
          setMessage(await readErrorMessage(response));
          return;
        }

        try {
          await queryClient.invalidateQueries({ queryKey: ['receipts'] });
        } catch {
          // The claim succeeded; navigation should not be blocked by cache refresh.
        }

        if (!isActive) return;
        router.replace('/receipts');
      } catch {
        if (!isActive) return;
        setStatus('error');
        setMessage('A network error occurred. Please check your connection.');
      }
    }

    void claimReceipt();

    return () => {
      isActive = false;
    };
  }, [attempt, isAuthLoading, queryClient, redirectTo, token]);

  if (redirectTo) {
    return <Redirect href={redirectTo} />;
  }

  return (
    <StorefrontScreenShell
      edges={['bottom']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <View style={styles.content}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: `${colors.tint}18`,
              borderColor: `${colors.tint}33`,
            },
          ]}
        >
          <Ionicons color={colors.tint} name="receipt-outline" size={30} />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>
          Your Receipt Has Changed.
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          We are moving this receipt into the app so you can access it any time.
        </Text>

        <View style={styles.statusRow}>
          {status === 'error' ? (
            <Ionicons
              color={colors.error}
              name="alert-circle-outline"
              size={20}
            />
          ) : (
            <ActivityIndicator color={colors.tint} />
          )}
          <Text
            style={[
              styles.statusText,
              { color: status === 'error' ? colors.error : colors.text },
            ]}
          >
            {message}
          </Text>
        </View>

        {status === 'error' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setAttempt((value) => value + 1)}
            style={[styles.button, { backgroundColor: colors.tint }]}
          >
            <Text
              style={[styles.buttonText, { color: colors.primaryForeground }]}
            >
              Try again
            </Text>
          </Pressable>
        ) : null}
      </View>
    </StorefrontScreenShell>
  );
}

const styles = StyleSheet.create({
  body: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    borderRadius: 14,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 24,
    width: '100%',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    alignItems: 'center',
    flex: 1,
    gap: 18,
    justifyContent: 'center',
    padding: 24,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 28,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  screen: {
    flex: 1,
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 48,
  },
  statusText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 32,
    textAlign: 'center',
  },
});
