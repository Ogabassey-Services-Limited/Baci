import {
  MERCHANT_SETTINGS_COLUMNS,
  normalizeRegisteredAddress,
  SOCIAL_MEDIA_KEYS,
} from '@baci/shared';
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
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    let socialMediaMerchant: unknown = null;
    if (body.social_media !== undefined || body.clear_social_media === true) {
      const incomingSocialMedia = body.social_media ?? {};
      const shouldClearSocialMedia =
        body.clear_social_media === true ||
        isFullBlankSocialMediaPayload(incomingSocialMedia);

      // Defense-in-depth (RFC 7386 merge semantics): merge the incoming object
      // over the existing row in one Postgres UPDATE so concurrent partial
      // requests cannot lose each other's handles.
      const { data, error } = await auth.supabase.rpc(
        'update_merchant_social_media',
        {
          p_clear: shouldClearSocialMedia,
          p_merchant_id: access.merchantId,
          p_social_media: incomingSocialMedia,
        }
      );

      if (error || !data) {
        console.error('Merchant social media update failed:', error);
        return NextResponse.json(
          { error: 'Failed to update merchant settings' },
          { status: 500 }
        );
      }

      socialMediaMerchant = data;
    }

    if (body.vat_registration_status !== undefined) {
      updates.vat_registration_status = body.vat_registration_status;
    }

    if (body.tax_identification_number !== undefined) {
      updates.tax_identification_number =
        body.tax_identification_number || null;
    }

    if (body.legal_entity_name !== undefined) {
      updates.legal_entity_name = body.legal_entity_name || null;
    }

    if (body.registered_address !== undefined) {
      updates.registered_address = normalizeRegisteredAddress(
        body.registered_address
      );
    }

    if (body.state_code !== undefined) {
      updates.state_code = body.state_code || null;
    }

    const hasColumnUpdates = Object.keys(updates).some(
      (key) => key !== 'updated_at'
    );

    if (hasColumnUpdates) {
      const { data: merchant, error } = await auth.supabase
        .from('merchants')
        .update(updates)
        .eq('id', access.merchantId)
        .select(MERCHANT_SETTINGS_COLUMNS)
        .single();

      if (error || !merchant) {
        console.error('Merchant settings update failed:', error);
        return NextResponse.json(
          { error: 'Failed to update merchant settings' },
          { status: 500 }
        );
      }

      return NextResponse.json({ merchant });
    }

    if (socialMediaMerchant) {
      return NextResponse.json({ merchant: socialMediaMerchant });
    }

    return NextResponse.json(
      {
        error: 'Validation failed',
        details: { _root: ['No changes provided'] },
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Invalid merchant settings payload:', error);
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
