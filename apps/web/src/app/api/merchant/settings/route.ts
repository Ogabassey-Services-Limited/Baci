import { normalizeRegisteredAddress, SOCIAL_MEDIA_KEYS } from '@baci/shared';
import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import {
  formatMerchantSettingsErrors,
  merchantSettingsRequestSchema,
} from '@/schemas/merchant-settings';

function isFullBlankSocialMediaPayload(
  socialMedia: Record<string, string | null | undefined>
): boolean {
  return (
    SOCIAL_MEDIA_KEYS.every((key) => Object.hasOwn(socialMedia, key)) &&
    Object.values(socialMedia).every(
      (value) => (value ?? '').trim().length === 0
    )
  );
}

function merchantSettingsAuthError(message: string) {
  if (message.includes('merchant_settings_mfa_required')) {
    return NextResponse.json(
      {
        code: 'MFA_REQUIRED',
        error: 'Verify your second factor before changing merchant settings.',
      },
      { status: 403 }
    );
  }

  if (message.includes('merchant_settings_reauthentication_required')) {
    return NextResponse.json(
      {
        code: 'REAUTHENTICATION_REQUIRED',
        error: 'Sign in again before changing merchant settings.',
      },
      { status: 403 }
    );
  }

  return null;
}

function merchantSettingsUpdateFailureResponse() {
  return NextResponse.json(
    {
      code: 'MERCHANT_SETTINGS_UPDATE_FAILED',
      error: 'Failed to update merchant settings',
    },
    { status: 500 }
  );
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  const { valid, response } = await checkCsrfProtection(request);
  if (!valid) {
    return (
      response ??
      NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (error) {
    console.error('Invalid merchant settings payload:', error);
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const parseResult = merchantSettingsRequestSchema.safeParse(rawBody);

  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        details: formatMerchantSettingsErrors(parseResult.error),
      },
      { status: 400 }
    );
  }

  try {
    const body = parseResult.data;
    const merchantContext = await getMerchantForApiRequest(
      auth.supabase,
      auth.user.id,
      { requestedMerchantId: body.merchantId }
    );
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'settings', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const settingsPatch: Record<string, unknown> = {};
    const hasSocialMediaUpdate =
      body.social_media !== undefined || body.clear_social_media === true;

    const incomingSocialMedia = body.social_media ?? {};
    const shouldClearSocialMedia =
      body.clear_social_media === true ||
      (body.social_media !== undefined &&
        isFullBlankSocialMediaPayload(incomingSocialMedia));

    if (body.vat_registration_status !== undefined) {
      settingsPatch.vat_registration_status = body.vat_registration_status;
    }

    if (body.tax_identification_number !== undefined) {
      settingsPatch.tax_identification_number =
        body.tax_identification_number || null;
    }

    if (body.legal_entity_name !== undefined) {
      settingsPatch.legal_entity_name = body.legal_entity_name || null;
    }

    if (body.registered_address !== undefined) {
      settingsPatch.registered_address = normalizeRegisteredAddress(
        body.registered_address
      );
    }

    if (body.state_code !== undefined) {
      settingsPatch.state_code = body.state_code || null;
    }

    if (!hasSocialMediaUpdate && Object.keys(settingsPatch).length === 0) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: { _root: ['No changes provided'] },
        },
        { status: 400 }
      );
    }

    const { data: merchant, error } = await auth.supabase.rpc(
      'update_merchant_social_media',
      {
        p_clear: shouldClearSocialMedia,
        p_merchant_id: merchantContext.merchantId,
        p_settings: settingsPatch,
        p_social_media: hasSocialMediaUpdate ? incomingSocialMedia : {},
      }
    );

    if (error || !merchant) {
      const authErrorResponse = merchantSettingsAuthError(error?.message ?? '');
      if (authErrorResponse) return authErrorResponse;

      console.error('Merchant settings update failed:', error);
      return merchantSettingsUpdateFailureResponse();
    }

    return NextResponse.json({ merchant });
  } catch (error) {
    console.error('Merchant settings update failed:', error);
    return merchantSettingsUpdateFailureResponse();
  }
}
