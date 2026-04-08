import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { BRAND } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { createLogger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

const log = createLogger('AuthCallback');

/**
 * OAuth Callback Handler (2026 Best Practice — Implicit Flow)
 *
 * With implicit flow, the tokens are returned directly in the URL fragment
 * and handled by signInWithGoogle in the auth store. This route serves as
 * a fallback landing page in case the deep link triggers navigation here.
 *
 * It checks if a session was already established and redirects accordingly.
 */
export default function AuthCallback() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { colors } = useTheme();

  useEffect(() => {
    log.debug('AuthCallback route reached. returnTo:', returnTo);

    async function checkSessionAndRedirect() {
      // Give the auth store a moment to process the session from the URL tokens
      await new Promise((resolve) => setTimeout(resolve, 500));

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        log.info('Session found, redirecting. User:', session.user?.email);
        if (returnTo) {
          const cleanReturnTo = decodeURIComponent(returnTo);
          log.debug('Redirecting to returnTo:', cleanReturnTo);
          router.replace(cleanReturnTo as '/');
        } else {
          log.debug('Redirecting to home');
          router.replace('/');
        }
      } else {
        log.warn('No session found on callback route, returning to login');
        router.replace('/auth/login');
      }
    }

    checkSessionAndRedirect();
  }, [returnTo]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={BRAND.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
