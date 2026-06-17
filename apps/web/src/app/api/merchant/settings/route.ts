import { normalizeRegisteredAddress, SOCIAL_MEDIA_KEYS } from '@baci/shared';
import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  formatMerchantSettingsErrors,
  updateMerchantSettingsSchema,
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

  const access = await getUserAccess(auth.supabase);
  if (!access) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  if (!hasPermission(access, 'settings', 'edit')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const rawBody = await request.json();
    const parseResult = updateMerchantSettingsSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatMerchantSettingsErrors(parseResult.error),
        },
        { status: 400 }
      );
    }

    const body = parseResult.data;
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
        p_merchant_id: access.merchantId,
        p_settings: settingsPatch,
        p_social_media: hasSocialMediaUpdate ? incomingSocialMedia : {},
      }
    );

    if (error || !merchant) {
      console.error('Merchant settings update failed:', error);
      return NextResponse.json(
        { error: 'Failed to update merchant settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({ merchant });
  } catch (error) {
    console.error('Invalid merchant settings payload:', error);
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
