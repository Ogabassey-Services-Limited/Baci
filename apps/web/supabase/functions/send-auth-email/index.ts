// NOTE: This file is intentionally duplicated. Byte-identical copies live at
// `supabase/functions/send-auth-email/index.ts` (the deployed entrypoint) and
// `apps/web/supabase/functions/send-auth-email/index.ts`. Keep them in sync —
// any change here must be mirrored in the other copy.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';
import {
  BACI_BRANDING,
  buildAuthEmailConfirmationUrl,
  extractMerchantLookup,
  generateEmailHtml,
  getCustomDomainCandidates,
  getEmailConfig,
  type MerchantBranding,
  type MerchantLookup,
  selectActiveCustomDomainForBranding,
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

async function merchantStillOwnsSendingDomain(
  supabase: ReturnType<typeof createClient>,
  merchantId: string,
  domain: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('domains')
    .select('id')
    .eq('merchant_id', merchantId)
    .in('domain', getCustomDomainCandidates(domain))
    .eq('status', 'active')
    .limit(1);

  if (error) {
    console.log('Sending-domain ownership lookup failed:', error.message);
    return false;
  }

  return Array.isArray(data) && data.length > 0;
}

async function fetchActiveCustomDomainForMerchant(
  supabase: ReturnType<typeof createClient>,
  merchantId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('domains')
    .select('domain, domain_type, is_primary')
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .in('domain_type', ['custom', 'purchased'])
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(2);

  if (error) {
    console.log('Merchant active custom-domain lookup failed:', error.message);
    return null;
  }

  return selectActiveCustomDomainForBranding(data);
}

// Is the auth-email recipient a verified customer of this merchant? Checked
// against the trusted `customers` table (keyed by merchant + auth user id),
// which — unlike `redirect_to` — cannot be forged by the caller. Fails closed
// (returns false → platform sender) on any lookup error.
async function recipientIsMerchantCustomer(
  supabase: ReturnType<typeof createClient>,
  merchantId: string,
  recipientUserId: string | null
): Promise<boolean> {
  if (!recipientUserId) {
    return false;
  }
  const { data, error } = await supabase
    .from('customers')
    .select('id')
    .eq('merchant_id', merchantId)
    .eq('user_id', recipientUserId)
    .limit(1);
  if (error) {
    console.log('Customer relationship lookup failed:', error.message);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

async function fetchMerchantSendingAddress(
  supabase: ReturnType<typeof createClient>,
  merchant: Pick<MerchantBrandingRow, 'id' | 'plan_tier'>,
  recipientUserId: string | null
): Promise<string | null> {
  if (!hasCustomEmailDomainEntitlement(merchant.plan_tier)) {
    return null;
  }

  // Security gate: `redirect_to` (which selects the merchant) is caller-
  // controllable via the allowlisted `*.usebaci.com/account/verify` redirect,
  // so an attacker could request an OTP for any address while pointing at a
  // victim merchant. Only send from the merchant's DKIM-signed custom domain
  // when the recipient is genuinely that merchant's customer; everyone else
  // (including first-time signups) gets the platform sender. The email stays
  // merchant-branded either way — only the From domain falls back.
  if (
    !(await recipientIsMerchantCustomer(supabase, merchant.id, recipientUserId))
  ) {
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

  const stillOwnsDomain = await merchantStillOwnsSendingDomain(
    supabase,
    merchant.id,
    data.domain as string
  );
  if (!stillOwnsDomain) {
    return null;
  }

  const localPart = (data.sender_local_part as string) || 'noreply';
  return `${localPart}@${data.domain}`;
}

async function fetchMerchantBranding(
  lookup: MerchantLookup,
  recipientUserId: string | null
): Promise<MerchantBranding | null> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    let merchant: MerchantBrandingRow | null = null;
    // The resolved live custom domain, sourced from `public.domains` (not from
    // a `merchants` column). Slug lookups also resolve this so links land on the custom-domain origin when one exists.
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
      if (merchant) {
        resolvedCustomDomain = await fetchActiveCustomDomainForMerchant(
          supabase,
          merchant.id
        );
      }
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
      merchant,
      recipientUserId
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
    const merchantBranding = await fetchMerchantBranding(
      merchantLookup,
      user?.id ?? null
    );
    if (merchantBranding) {
      branding = merchantBranding;
      console.log('Using merchant branding');
    }
  }

  const config = getEmailConfig(emailType, branding.businessName);

  const confirmationUrl = buildAuthEmailConfirmationUrl({
    branding,
    emailType,
    redirectTo: emailData.redirect_to,
    siteUrl: emailData.site_url,
    tokenHash: emailData.token_hash,
  });
  if (!confirmationUrl) {
    console.error('Invalid site URL for auth email:', emailData.site_url);
    return new Response(
      JSON.stringify({ error: 'Invalid email configuration' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // The CTA points at /auth/confirm (token_hash), so clicking it verifies the
  // token and signs the user in directly — the 6-digit code stays as a manual
  // fallback for forwarded mail or a different browser/device.
  const htmlBody = generateEmailHtml(
    config,
    confirmationUrl,
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
    `Continue: ${confirmationUrl}`,
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
    const emailRequestBody = {
      to: [{ email_address: { address: user.email } }],
      subject: config.subject,
      htmlbody: htmlBody,
      textbody: textBody,
    };
    // Bound the ZeptoMail call so a slow/hung API can't keep the auth-email
    // function open until the runtime kills it. Applies to both the primary and
    // fallback sends (a timeout aborts the fetch and is handled by the catch
    // below as a delivery failure).
    const ZEPTOMAIL_SEND_TIMEOUT_MS = 10_000;
    const sendWithFrom = (address: string) =>
      fetch('https://api.zeptomail.com/v1.1/email', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Zoho-enczapikey ${ZEPTOMAIL_TOKEN}`,
        },
        body: JSON.stringify({
          ...emailRequestBody,
          from: { address, name: senderName },
        }),
        signal: AbortSignal.timeout(ZEPTOMAIL_SEND_TIMEOUT_MS),
      });

    // Only status-level diagnostics are logged/returned — ZeptoMail response
    // bodies can echo recipient PII, so they are never logged or exposed.
    const deliveryFailed = new Response(
      JSON.stringify({ error: 'Email delivery failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
    const usingCustomSender = Boolean(branding.sendingFromAddress);

    // A custom sender can fail by returning a non-2xx response OR by throwing
    // (AbortSignal.timeout, DNS/TLS, transient network). Both must fall back to
    // the platform sender so a merchant-domain hiccup never blocks a customer's
    // auth email. A platform-sender throw is a genuine failure → outer catch.
    let response: Response | null = null;
    try {
      response = await sendWithFrom(fromAddress);
      console.log('ZeptoMail response status:', response.status);
    } catch (sendError) {
      if (!usingCustomSender) {
        throw sendError;
      }
      console.warn('Custom auth-email sender threw; retrying with platform');
    }

    if (usingCustomSender && (response === null || !response.ok)) {
      console.warn(
        'Custom auth-email sender failed; retrying with platform sender',
        response?.status ?? 'threw'
      );
      const fallbackResponse = await sendWithFrom('noreply@usebaci.com');
      console.log(
        'ZeptoMail fallback response status:',
        fallbackResponse.status
      );

      if (fallbackResponse.ok) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return deliveryFailed;
    }

    if (!response?.ok) {
      return deliveryFailed;
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
