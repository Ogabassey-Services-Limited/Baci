import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { generateUUID } from '@/utils/uuid';

interface AppleSignInResult {
  cancelled?: boolean;
  code?: string;
  error: string | null;
  metadata?: Record<string, boolean | null>;
  session: Session | null;
  user: User | null;
}

function buildAppleFullName(
  fullName: {
    familyName?: string | null;
    givenName?: string | null;
  } | null
): {
  familyName: string | null;
  fullName: string | null;
  givenName: string | null;
} {
  const givenName = fullName?.givenName?.trim() || null;
  const familyName = fullName?.familyName?.trim() || null;
  const fullNameValue = [givenName, familyName]
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    familyName,
    fullName: fullNameValue || null,
    givenName,
  };
}

export async function signInWithAppleNative(): Promise<AppleSignInResult> {
  if (Platform.OS !== 'ios') {
    return {
      code: 'apple_platform_not_supported',
      error: 'Apple Sign-In is only available on iOS devices.',
      session: null,
      user: null,
    };
  }

  try {
    const AppleAuthentication = await import('expo-apple-authentication');
    const isAvailable = await AppleAuthentication.isAvailableAsync();

    if (!isAvailable) {
      return {
        code: 'apple_not_available',
        error: 'Apple Sign-In is not available on this device.',
        session: null,
        user: null,
      };
    }

    const rawNonce = generateUUID();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce
    );

    const credential = await AppleAuthentication.signInAsync({
      nonce: hashedNonce,
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      return {
        code: 'apple_missing_identity_token',
        error: 'Apple sign-in failed: No identity token received.',
        metadata: {
          hasAuthorizationCode: Boolean(credential.authorizationCode),
          hasEmail: Boolean(credential.email),
          hasFullName: Boolean(credential.fullName),
        },
        session: null,
        user: null,
      };
    }

    const { familyName, fullName, givenName } = buildAppleFullName(
      credential.fullName
    );

    const { data, error } = await supabase.auth.signInWithIdToken({
      nonce: rawNonce,
      provider: 'apple',
      token: credential.identityToken,
    });

    if (error || !data.session || !data.user) {
      return {
        code: error
          ? 'apple_supabase_exchange_failed'
          : 'apple_missing_session',
        error:
          error?.message ?? 'Apple sign-in completed without a valid session.',
        metadata: {
          hasAuthorizationCode: Boolean(credential.authorizationCode),
          hasEmail: Boolean(credential.email),
          hasFullName: Boolean(fullName),
        },
        session: null,
        user: null,
      };
    }

    const userDataUpdates: Record<string, string> = {};
    if (fullName && !data.user.user_metadata?.full_name) {
      userDataUpdates.full_name = fullName;
    }
    if (givenName && !data.user.user_metadata?.given_name) {
      userDataUpdates.given_name = givenName;
    }
    if (familyName && !data.user.user_metadata?.family_name) {
      userDataUpdates.family_name = familyName;
    }

    if (Object.keys(userDataUpdates).length > 0) {
      try {
        const { error: updateError } = await supabase.auth.updateUser({
          data: userDataUpdates,
        });

        if (updateError) {
          console.warn(
            '[AppleSignIn] Failed to update Apple profile metadata:',
            updateError
          );
        }
      } catch (updateError) {
        console.warn(
          '[AppleSignIn] Failed to update Apple profile metadata:',
          updateError
        );
      }
    }

    return {
      error: null,
      metadata: {
        hasAuthorizationCode: Boolean(credential.authorizationCode),
        hasEmail: Boolean(credential.email),
        hasFullName: Boolean(fullName),
      },
      session: data.session,
      user: data.user,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as Error & { code: string }).code === 'ERR_REQUEST_CANCELED'
    ) {
      return {
        cancelled: true,
        code: 'apple_user_cancelled',
        error: null,
        session: null,
        user: null,
      };
    }

    return {
      code: 'apple_unknown_error',
      error:
        error instanceof Error
          ? error.message
          : 'Apple sign-in failed. Please try again.',
      session: null,
      user: null,
    };
  }
}
