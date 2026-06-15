import type { Session, User } from '@supabase/supabase-js';
import { trackAuthTelemetry } from '@/services/auth-telemetry';

export type SocialAuthProvider = 'google' | 'apple';

export interface SocialSignInResult {
  cancelled?: boolean;
  code?: string;
  error: string | null;
  metadata?: Record<string, boolean | null>;
  session: Session | null;
  user: User | null;
}

const socialAuthErrorMessages: Record<SocialAuthProvider, string> = {
  apple: 'Apple sign-in failed. Please try again.',
  google: 'Google sign-in failed. Please try again.',
};

const socialAuthStoreErrorCodes: Record<SocialAuthProvider, string> = {
  apple: 'apple_store_error',
  google: 'google_store_error',
};

interface SocialAuthStateUpdate {
  activeAuthProvider?: SocialAuthProvider | null;
  isAuthenticating?: boolean;
  isAuthenticated?: boolean;
  isInitialized?: boolean;
  isLoading?: boolean;
  session?: Session | null;
  user?: User | null;
}

interface RunSocialSignInOptions {
  getCurrentUserId: () => string | undefined;
  nativeSignIn: () => Promise<SocialSignInResult>;
  onResetUserStores: () => void | Promise<void>;
  setState: (state: SocialAuthStateUpdate) => void;
}

export async function runSocialSignIn(
  provider: SocialAuthProvider,
  {
    getCurrentUserId,
    nativeSignIn,
    onResetUserStores,
    setState,
  }: RunSocialSignInOptions
): Promise<{ cancelled?: boolean; error: string | null }> {
  const startedAt = Date.now();

  setState({ activeAuthProvider: provider, isAuthenticating: true });
  trackAuthTelemetry({
    provider,
    stage: 'start',
  });

  try {
    const result = await nativeSignIn();

    if (result.cancelled) {
      trackAuthTelemetry({
        code: result.code,
        durationMs: Date.now() - startedAt,
        metadata: result.metadata,
        provider,
        stage: 'cancel',
      });
      return { cancelled: true, error: null };
    }

    if (result.error || !result.session || !result.user) {
      trackAuthTelemetry({
        code: result.code,
        durationMs: Date.now() - startedAt,
        metadata: result.metadata,
        provider,
        stage: 'failure',
      });
      return { error: result.error ?? socialAuthErrorMessages[provider] };
    }

    const currentUserId = getCurrentUserId();
    setState({
      isAuthenticated: true,
      isInitialized: true,
      isLoading: false,
      session: result.session,
      user: result.user,
    });

    if (currentUserId !== result.user.id) {
      void onResetUserStores();
    }

    trackAuthTelemetry({
      durationMs: Date.now() - startedAt,
      metadata: result.metadata,
      provider,
      stage: 'success',
    });

    return { error: null };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : socialAuthErrorMessages[provider];

    trackAuthTelemetry({
      code: socialAuthStoreErrorCodes[provider],
      durationMs: Date.now() - startedAt,
      provider,
      stage: 'failure',
    });

    return { error: message };
  } finally {
    setState({ activeAuthProvider: null, isAuthenticating: false });
  }
}
