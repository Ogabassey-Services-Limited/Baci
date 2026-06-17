import {
  MERCHANT_SETTINGS_COLUMNS,
  mergeSocialMediaValues,
  normalizeRegisteredAddress,
  type SocialMediaValues,
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

    if (body.social_media !== undefined) {
      // Defense-in-depth (RFC 7386 merge semantics): merge the incoming
      // payload over the EXISTING row so a partial caller can't drop handles
      // it never touched. Read the current value scoped to this merchant.
      const { data: existing } = await auth.supabase
        .from('merchants')
        .select('social_media')
        .eq('id', access.merchantId)
        .single<{ social_media: SocialMediaValues | null }>();

      const mergedSocialMedia = mergeSocialMediaValues(
        existing?.social_media,
        body.social_media
      );

      // Skip the write when the merge collapses to {} UNLESS the caller
      // explicitly asked to clear all handles. This stops an errored/partial
      // payload from wiping social_media while still honoring a real clear.
      if (
        Object.keys(mergedSocialMedia).length > 0 ||
        body.clear_social_media === true
      ) {
        updates.social_media = mergedSocialMedia;
      }
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
  } catch (error) {
    console.error('Invalid merchant settings payload:', error);
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
