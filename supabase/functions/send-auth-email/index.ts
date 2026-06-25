// NOTE: This file is intentionally duplicated. Byte-identical copies live at
// `supabase/functions/send-auth-email/index.ts` (the deployed entrypoint) and
// `apps/web/supabase/functions/send-auth-email/index.ts`. Keep them in sync —
// any change here must be mirrored in the other copy.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';
import {
  BACI_BRANDING,
  extractMerchantLookup,
  generateEmailHtml,
  getCustomDomainCandidates,
  getEmailConfig,
  type MerchantBranding,
  type MerchantLookup,
} from './auth-email-template.ts';

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

const ZEPTOMAIL_TOKEN = getRequiredEnv('ZEPTOMAIL_TOKEN');
const SEND_EMAIL_HOOK_SECRET = getRequiredEnv('SEND_EMAIL_HOOK_SECRET');
const SUPABASE_URL = getRequiredEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

const BACI_PRIMARY_COLOR = '#1e40af';
const BACI_BUTTON_COLOR = '#fbbf24';

interface EmailPayload {
  user: {
    id: string;
    email: string;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to?: string;
    email_action_type: string;
    site_url: string;
  };
}

/**
 * Fetch merchant branding from the database by slug or custom domain.
 * Returns null if the merchant is not found.
 */
// Columns that actually exist on `merchants`. Custom domains are normalized
// into `public.domains`; there is NO `merchants.custom_domain` column, so it
// must never appear in a select (PostgREST rejects the whole query if it does).
// ⚠️ Keep MERCHANT_BRANDING_COLUMNS and MerchantBrandingRow in sync — a Deno
// edge fn gets no typed Supabase inference, so a mismatch surfaces only at runtime.
const MERCHANT_BRANDING_COLUMNS =
  'id, business_name, logo_url, email_logo_url, brand_colors, slug, support_email, email_sender_name, email, plan_tier';

interface MerchantBrandingRow {
  id: string;
  brand_colors: { primary?: string; accent?: string } | null;
  business_name: string;
  email: string | null;
  email_logo_url: string | null;
  email_sender_name: string | null;
  logo_url: string | null;
  plan_tier: string | null;
  slug: string | null;
  support_email: string | null;
}

/**
 * The merchant's verified + enabled custom sending address (e.g.
 * "noreply@ogabassey.com"), or null to fall back to the platform sender.
 * Aligning the From-domain with the brand/links materially improves inbox
 * placement; see merchant_email_domains migration.
 */
function hasCustomEmailDomainEntitlement(planTier: string | null): boolean {
  return (
    planTier === 'pro' || planTier === 'business' || planTier === 'enterprise'
  );
}

async function fetchMerchantSendingAddress(
  supabase: ReturnType<typeof createClient>,
  merchant: Pick<MerchantBrandingRow, 'id' | 'plan_tier'>
): Promise<string | null> {
  if (!hasCustomEmailDomainEntitlement(merchant.plan_tier)) {
    return null;
  }

  const { data, error } = await supabase
    .from('merchant_email_domains')
    .select('domain, sender_local_part')
    .eq('merchant_id', merchant.id)
    .eq('enabled', true)
    .eq('status', 'verified')
    .maybeSingle();

  if (error) {
    // Fail open to the platform sender — never block an auth email over this.
    console.log('Sending-domain lookup failed:', error.message);
    return null;
  }
  if (!data?.domain) {
    return null;
  }
  const localPart = (data.sender_local_part as string) || 'noreply';
  return `${localPart}@${data.domain}`;
}

async function fetchMerchantBranding(
  lookup: MerchantLookup
): Promise<MerchantBranding | null> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    let merchant: MerchantBrandingRow | null = null;
    // The resolved live custom domain, sourced from `public.domains` (not from
    // a `merchants` column). Stays null for slug-based lookups.
    let resolvedCustomDomain: string | null = null;

    if (lookup.slug) {
      const { data, error } = await supabase
        .from('merchants')
        .select(MERCHANT_BRANDING_COLUMNS)
        .eq('slug', lookup.slug)
        .eq('is_published', true)
        .maybeSingle();

      if (error) {
        console.log('Merchant slug lookup failed:', error.message);
      }
      merchant = data;
    }

    if (!merchant && lookup.customDomain) {
      // Resolve custom domains via `public.domains`. The domain→merchant
      // resolution mirrors getCachedMerchantByDomain in the web app: match an
      // *active* domain, then load the merchant. The service-role client
      // bypasses RLS, so we filter status='active' explicitly. `verified_at`
      // is intentionally NOT required — most live domains have a null
      // verified_at, and adding that filter would drop ~97% of active custom
      // domains. (Unlike getCachedMerchantByDomain, we additionally require
      // is_published=true: auth emails are only branded for published stores.)
      for (const candidate of getCustomDomainCandidates(lookup.customDomain)) {
        const { data: domainRow, error: domainError } = await supabase
          .from('domains')
          .select('merchant_id, domain')
          .eq('domain', candidate)
          .eq('status', 'active')
          .maybeSingle();

        if (domainError) {
          console.log('Domain lookup failed:', domainError.message);
          continue;
        }
        if (!domainRow) continue;

        const { data, error } = await supabase
          .from('merchants')
          .select(MERCHANT_BRANDING_COLUMNS)
          .eq('id', domainRow.merchant_id)
          .eq('is_published', true)
          .maybeSingle();

        if (error) {
          console.log('Merchant custom-domain lookup failed:', error.message);
          continue;
        }

        if (data) {
          merchant = data;
          resolvedCustomDomain = domainRow.domain;
          break;
        }
      }
    }

    if (!merchant) {
      console.log('Merchant not found for auth email lookup');
      return null;
    }

    const brandColors = merchant.brand_colors as {
      primary?: string;
      accent?: string;
    } | null;

    const sendingFromAddress = await fetchMerchantSendingAddress(
      supabase,
      merchant
    );

    return {
      businessName: merchant.business_name,
      customDomain: resolvedCustomDomain,
      emailLogoUrl: merchant.email_logo_url || null,
      emailSenderName: merchant.email_sender_name,
      logoUrl: merchant.logo_url || null,
      primaryColor: brandColors?.primary || BACI_PRIMARY_COLOR,
      buttonColor:
        brandColors?.accent || brandColors?.primary || BACI_BUTTON_COLOR,
      buttonTextColor: '#ffffff',
      slug: merchant.slug,
      supportEmail: merchant.support_email || merchant.email,
      sendingFromAddress,
    };
  } catch (err) {
    console.error('Error fetching merchant branding:', err);
    return null;
  }
}

function canUseRedirectAsNext(
  nextUrl: URL,
  siteUrl: URL,
  branding: MerchantBranding
): boolean {
  if (nextUrl.origin === siteUrl.origin) {
    return true;
  }

  const nextLookup = extractMerchantLookup(nextUrl.toString());
  if (nextLookup?.slug && branding.slug) {
    return nextLookup.slug === branding.slug.toLowerCase();
  }

  if (nextLookup?.customDomain && branding.customDomain) {
    return getCustomDomainCandidates(branding.customDomain).includes(
      nextLookup.customDomain
    );
  }

  return false;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  // Verify webhook signature
  let data: EmailPayload;
  try {
    const wh = new Webhook(SEND_EMAIL_HOOK_SECRET);
    data = wh.verify(payload, headers) as EmailPayload;
  } catch (error) {
    console.error('Webhook verification failed:', error);
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { user, email_data: emailData } = data;
  if (
    !emailData ||
    typeof emailData !== 'object' ||
    !emailData.site_url ||
    !emailData.token_hash ||
    !emailData.email_action_type
  ) {
    console.error('Missing auth email redirect inputs', {
      siteUrl: emailData?.site_url,
      hasTokenHash: Boolean(emailData?.token_hash),
      emailType: emailData?.email_action_type,
    });
    return new Response(
      JSON.stringify({ error: 'Invalid email configuration' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
  const emailType = emailData.email_action_type;

  // Resolve merchant branding from storefront auth redirects. Custom domains
  // such as ogabassey.com do not expose the merchant slug in the hostname.
  const merchantLookup = extractMerchantLookup(
    emailData.redirect_to,
    emailData.site_url
  );
  let branding = BACI_BRANDING;

  if (merchantLookup) {
    console.log('Detected merchant auth email lookup');
    const merchantBranding = await fetchMerchantBranding(merchantLookup);
    if (merchantBranding) {
      branding = merchantBranding;
      console.log('Using merchant branding');
    }
  }

  const config = getEmailConfig(emailType, branding.businessName);

  let confirmationUrl: URL;
  try {
    confirmationUrl = new URL('/auth/confirm', emailData.site_url);
  } catch (error) {
    console.error(
      'Invalid site URL for auth email:',
      emailData.site_url,
      error
    );
    return new Response(
      JSON.stringify({ error: 'Invalid email configuration' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  confirmationUrl.searchParams.set('token_hash', emailData.token_hash);
  confirmationUrl.searchParams.set('type', emailType);

  if (emailData.redirect_to) {
    if (/^https?:\/\//i.test(emailData.redirect_to)) {
      try {
        const nextUrl = new URL(emailData.redirect_to);
        const siteUrl = new URL(emailData.site_url);

        // Carry a same-storefront `next` so /auth/confirm redirects back into
        // the storefront after it verifies the token. This includes custom
        // domains where the auth handler itself is still on the platform host.
        if (canUseRedirectAsNext(nextUrl, siteUrl, branding)) {
          confirmationUrl.searchParams.set('next', nextUrl.toString());
        }
      } catch (error) {
        console.warn('Ignoring invalid auth redirect target:', error);
      }
    } else {
      confirmationUrl.searchParams.set('next', emailData.redirect_to);
    }
  }

  // The CTA points at /auth/confirm (token_hash), so clicking it verifies the
  // token and signs the user in directly — the 6-digit code stays as a manual
  // fallback for forwarded mail or a different browser/device.
  const htmlBody = generateEmailHtml(
    config,
    confirmationUrl.toString(),
    branding,
    emailData.token
  );

  // Sender name: merchant name for merchant emails, "Baci" for platform emails.
  const senderName =
    branding.businessName !== 'Baci'
      ? branding.emailSenderName || branding.businessName
      : 'Baci';

  // From-address: a merchant's verified+enabled custom domain when present,
  // otherwise the platform sender. Sending from the merchant's own domain
  // aligns From ↔ brand ↔ links and improves inbox placement.
  const fromAddress = branding.sendingFromAddress || 'noreply@usebaci.com';

  // Plain-text alternative. HTML-only mail is a deliverability/spam signal;
  // a multipart message scores better.
  const textBodyLines = [
    config.subject,
    '',
    ...(emailData.token ? [`Your code: ${emailData.token}`] : []),
    `Continue: ${confirmationUrl.toString()}`,
    '',
    'If you did not request this email, you can safely ignore it.',
  ];
  const textBody = textBodyLines.join('\n');

  console.log(
    'Sending auth email',
    'Type:',
    emailType,
    'MerchantBranded:',
    branding.businessName !== 'Baci',
    'CustomFrom:',
    Boolean(branding.sendingFromAddress)
  );

  // Send via ZeptoMail
  try {
    const response = await fetch('https://api.zeptomail.com/v1.1/email', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Zoho-enczapikey ${ZEPTOMAIL_TOKEN}`,
      },
      body: JSON.stringify({
        from: { address: fromAddress, name: senderName },
        to: [{ email_address: { address: user.email } }],
        subject: config.subject,
        htmlbody: htmlBody,
        textbody: textBody,
      }),
    });

    const responseText = await response.text();
    console.log('ZeptoMail response:', response.status, responseText);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: 'ZeptoMail failed', details: responseText }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Fetch error:', error);
    return new Response(
      JSON.stringify({ error: 'Email delivery failed. Please try again.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
