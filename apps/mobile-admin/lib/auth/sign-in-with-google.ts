import type {
  SignInResponse,
  SignInSuccessResponse,
} from '@react-native-google-signin/google-signin';
import type { Session, User } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

interface GoogleSignInModule {
  GoogleSignin: {
    configure: (options: {
      iosClientId?: string;
      offlineAccess?: boolean;
      scopes?: string[];
      webClientId?: string;
    }) => void;
    getTokens?: () => Promise<{
      accessToken?: string | null;
      idToken?: string | null;
    }>;
    hasPlayServices: () => Promise<boolean>;
    signIn: () => Promise<SignInResponse>;
  };
  isSuccessResponse: (
    response: SignInResponse
  ) => response is SignInSuccessResponse;
  statusCodes: Record<string, string>;
}

interface GoogleSignInResult {
  cancelled?: boolean;
  code?: string;
  error: string | null;
  metadata?: Record<string, boolean | null>;
  session: Session | null;
  user: User | null;
}

const googleConfig = {
  iosClientId:
    Constants.expoConfig?.extra?.googleIosClientId ??
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  webClientId:
    Constants.expoConfig?.extra?.googleWebClientId ??
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
};

let cachedGoogleModule: GoogleSignInModule | null = null;
let lastGoogleConfigSignature: string | null = null;

function getGoogleConfigError(): {
  code: 'google_missing_client_id';
  error: string;
} | null {
  const missingConfigFields = [
    Platform.OS === 'ios' && !googleConfig.iosClientId
      ? 'googleConfig.iosClientId'
      : null,
    !googleConfig.webClientId ? 'googleConfig.webClientId' : null,
  ].filter(Boolean);

  if (missingConfigFields.length === 0) {
    return null;
  }

  return {
    code: 'google_missing_client_id',
    error: `${missingConfigFields.join(' and ')} must be set before GoogleSignin.configure() can start Google Sign-in for this build.`,
  };
}

async function loadGoogleSignInModule(): Promise<GoogleSignInModule | null> {
  if (cachedGoogleModule) {
    return cachedGoogleModule;
  }

  try {
    const googleSignInImports = await import(
      '@react-native-google-signin/google-signin'
    );

    cachedGoogleModule = {
      GoogleSignin: googleSignInImports.GoogleSignin,
      isSuccessResponse: googleSignInImports.isSuccessResponse,
      statusCodes: googleSignInImports.statusCodes,
    };

    return cachedGoogleModule;
  } catch (error) {
    console.error(
      '[GoogleSignIn] Failed to load native Google Sign-In module:',
      error
    );
    return null;
  }
}

function ensureGoogleConfigured(googleModule: GoogleSignInModule): void {
  const googleConfigError = getGoogleConfigError();
  if (googleConfigError) {
    throw Object.assign(new Error(googleConfigError.error), {
      code: googleConfigError.code,
    });
  }

  const configSignature = `${googleConfig.iosClientId ?? ''}:${googleConfig.webClientId ?? ''}`;

  if (lastGoogleConfigSignature === configSignature) {
    return;
  }

  googleModule.GoogleSignin.configure({
    iosClientId: googleConfig.iosClientId,
    webClientId: googleConfig.webClientId,
    offlineAccess: true,
    scopes: ['profile', 'email'],
  });

  lastGoogleConfigSignature = configSignature;
}

export async function signInWithGoogleNative(): Promise<GoogleSignInResult> {
  if (Platform.OS === 'web') {
    return {
      code: 'google_platform_not_supported',
      error: 'Google Sign-in is only available on native devices.',
      session: null,
      user: null,
    };
  }

  const googleConfigError = getGoogleConfigError();
  if (googleConfigError) {
    return {
      ...googleConfigError,
      session: null,
      user: null,
    };
  }

  const googleModule = await loadGoogleSignInModule();
  if (!googleModule) {
    return {
      code: 'google_native_module_unavailable',
      error: 'Google Sign-in is not available in this build.',
      session: null,
      user: null,
    };
  }

  try {
    ensureGoogleConfigured(googleModule);
    const hasPlayServices = await googleModule.GoogleSignin.hasPlayServices();
    if (!hasPlayServices) {
      return {
        code: 'google_play_services_unavailable',
        error: 'Google Play Services is not available on this device.',
        session: null,
        user: null,
      };
    }

    const response = await googleModule.GoogleSignin.signIn();
    let accessToken: string | null = null;
    let idToken: string | null = null;
    let usedTokenFallback = false;

    if (googleModule.isSuccessResponse(response)) {
      idToken = response.data?.idToken ?? null;

      if (typeof googleModule.GoogleSignin.getTokens === 'function') {
        try {
          const tokenResponse = await googleModule.GoogleSignin.getTokens();
          accessToken = tokenResponse?.accessToken ?? null;

          if (!idToken && tokenResponse?.idToken) {
            idToken = tokenResponse.idToken;
            usedTokenFallback = true;
          }
        } catch (_tokenError) {
          // Continue with the signIn response if getTokens fails.
        }
      }
    }

    if (!idToken) {
      return {
        code: 'google_missing_id_token',
        error: 'Google sign-in failed: No ID token received.',
        metadata: {
          hadResponseIdToken:
            googleModule.isSuccessResponse(response) &&
            Boolean(response.data?.idToken),
          usedTokenFallback,
        },
        session: null,
        user: null,
      };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      access_token: accessToken ?? undefined,
      provider: 'google',
      token: idToken,
    });

    if (error || !data.session || !data.user) {
      return {
        code: error
          ? 'google_supabase_exchange_failed'
          : 'google_missing_session',
        error:
          error?.message ?? 'Google sign-in completed without a valid session.',
        metadata: {
          hadResponseIdToken: true,
          usedTokenFallback,
        },
        session: null,
        user: null,
      };
    }

    return {
      error: null,
      metadata: {
        hadResponseIdToken: !usedTokenFallback,
        usedTokenFallback,
      },
      session: data.session,
      user: data.user,
    };
  } catch (error) {
    const errorWithCode = error as { code?: string; message?: string };
    const { statusCodes } = googleModule;

    if (errorWithCode?.code === statusCodes.SIGN_IN_CANCELLED) {
      return {
        cancelled: true,
        code: 'google_user_cancelled',
        error: null,
        session: null,
        user: null,
      };
    }

    if (errorWithCode?.code === statusCodes.IN_PROGRESS) {
      return {
        code: 'google_in_progress',
        error: 'Google sign-in is already in progress.',
        session: null,
        user: null,
      };
    }

    if (errorWithCode?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return {
        code: 'google_play_services_unavailable',
        error: 'Google Play Services is not available on this device.',
        session: null,
        user: null,
      };
    }

    return {
      code: errorWithCode?.code ?? 'google_unknown_error',
      error:
        errorWithCode?.message ?? 'Google sign-in failed. Please try again.',
      session: null,
      user: null,
    };
  }
}
