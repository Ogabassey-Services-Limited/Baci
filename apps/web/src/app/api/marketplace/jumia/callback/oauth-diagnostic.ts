import type { NextResponse } from 'next/server';
import {
  exchangeJumiaCode,
  sanitizeJumiaErrorDetails,
} from '@/lib/jumia/helpers';
import { jumiaOAuthDiagnostic } from '@/lib/jumia/oauth-diagnostic';
import { logger } from '@/lib/logger';
import { getPlatformAdminAuth } from '@/lib/platform-admin-auth';

export async function runJumiaOAuthCallbackDiagnostic({
  apiUserId,
  clientId,
  clientSecret,
  code,
  createRedirect,
  diagnosticId,
  redirectUri,
  requestUrl,
  variant,
}: {
  apiUserId: string;
  clientId: string;
  clientSecret: string;
  code: string;
  createRedirect: (query: Record<string, string | undefined>) => NextResponse;
  diagnosticId: string;
  redirectUri: string;
  requestUrl: string;
  variant?: string;
}): Promise<NextResponse> {
  const platformAdminAuth = await getPlatformAdminAuth();
  if (
    platformAdminAuth.status !== 'authenticated' ||
    platformAdminAuth.user.id !== apiUserId
  ) {
    logger.warn({
      message: '[Jumia OAuth Diagnostic] Authorization rejected',
      diagnostic_id: diagnosticId,
      reason: 'platform_admin_required',
    });
    return createRedirect({ error: 'diagnostic_forbidden' });
  }

  const callbackUrl = new URL(requestUrl);
  const configuredRedirectUrl = new URL(redirectUri);
  logger.info({
    message: '[Jumia OAuth Diagnostic] Callback accepted',
    authorization_code_length: code.length,
    callback_host: callbackUrl.hostname,
    callback_path: callbackUrl.pathname,
    diagnostic_id: diagnosticId,
    oauth_state_match: true,
    redirect_host: configuredRedirectUrl.hostname,
    redirect_path: configuredRedirectUrl.pathname,
    variant: variant ?? 'default',
  });

  const tokenExchangeStartedAt = Date.now();
  let tokens: Awaited<ReturnType<typeof exchangeJumiaCode>>;
  try {
    tokens = await exchangeJumiaCode({
      clientId,
      clientSecret,
      code,
      redirectUri,
    });
  } catch (tokenError) {
    const tokenErrorDetails = sanitizeJumiaErrorDetails(
      (tokenError as Error & { details?: unknown }).details
    );
    logger.error({
      message: 'Jumia OAuth diagnostic token exchange failed',
      diagnostic_id: diagnosticId,
      token_exchange_duration_ms: Date.now() - tokenExchangeStartedAt,
      variant: variant ?? 'default',
      error:
        tokenError instanceof Error
          ? {
              name: tokenError.name,
              message: tokenError.message,
              status: (tokenError as Error & { status?: number }).status,
              ...(tokenErrorDetails === undefined
                ? {}
                : { details: tokenErrorDetails }),
            }
          : String(tokenError).slice(0, 200),
    });
    return createRedirect({ error: 'token_exchange_failed' });
  }

  const evidence = jumiaOAuthDiagnostic.buildEvidence(tokens);
  logger.info({
    message: '[Jumia OAuth Diagnostic] Token exchange completed',
    diagnostic_id: diagnosticId,
    token_exchange_duration_ms: Date.now() - tokenExchangeStartedAt,
    variant: variant ?? 'default',
    ...evidence,
  });

  const response = createRedirect(
    jumiaOAuthDiagnostic.buildRedirectQuery({
      diagnosticId,
      tokens,
      variant,
    })
  );
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
