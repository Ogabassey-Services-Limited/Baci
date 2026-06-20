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
async function fetchMerchantBranding(
  lookup: MerchantLookup
): Promise<MerchantBranding | null> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    let merchant: {
      brand_colors: { primary?: string; accent?: string } | null;
      business_name: string;
      custom_domain: string | null;
      email: string | null;
      email_sender_name: string | null;
      logo_url: string | null;
      slug: string | null;
      support_email: string | null;
    } | null = null;

    if (lookup.slug) {
      const { data, error } = await supabase
        .from('merchants')
        .select(
          'business_name, logo_url, brand_colors, slug, custom_domain, support_email, email_sender_name, email'
        )
        .eq('slug', lookup.slug)
        .eq('is_published', true)
        .maybeSingle();

      if (error) {
        console.log('Merchant slug lookup failed:', lookup.slug, error.message);
      }
      merchant = data;
    }

    if (!merchant && lookup.customDomain) {
      for (const customDomain of getCustomDomainCandidates(
        lookup.customDomain
      )) {
        const { data, error } = await supabase
          .from('merchants')
          .select(
            'business_name, logo_url, brand_colors, slug, custom_domain, support_email, email_sender_name, email'
          )
          .eq('custom_domain', customDomain)
          .eq('is_published', true)
          .maybeSingle();

        if (error) {
          console.log(
            'Merchant custom-domain lookup failed:',
            customDomain,
            error.message
          );
          continue;
        }

        if (data) {
          merchant = data;
          break;
        }
      }
    }

    if (!merchant) {
      console.log('Merchant not found for auth email lookup:', lookup);
      return null;
    }

    const brandColors = merchant.brand_colors as {
      primary?: string;
      accent?: string;
    } | null;

    return {
      businessName: merchant.business_name,
      customDomain: merchant.custom_domain,
      emailSenderName: merchant.email_sender_name,
      logoUrl: merchant.logo_url || null,
      primaryColor: brandColors?.primary || BACI_PRIMARY_COLOR,
      buttonColor:
        brandColors?.accent || brandColors?.primary || BACI_BUTTON_COLOR,
      buttonTextColor: '#ffffff',
      slug: merchant.slug,
      supportEmail: merchant.support_email || merchant.email,
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

  console.log(
    'Token length:',
    ZEPTOMAIL_TOKEN.length,
    'Secret length:',
    SEND_EMAIL_HOOK_SECRET.length
  );

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
    console.log('Detected merchant auth email lookup:', merchantLookup);
    const merchantBranding = await fetchMerchantBranding(merchantLookup);
    if (merchantBranding) {
      branding = merchantBranding;
      console.log('Using merchant branding:', branding.businessName);
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

  let actionUrlOverride: string | undefined;

  if (emailData.redirect_to) {
    if (/^https?:\/\//i.test(emailData.redirect_to)) {
      try {
        const nextUrl = new URL(emailData.redirect_to);
        const siteUrl = new URL(emailData.site_url);

        if (nextUrl.origin === siteUrl.origin) {
          confirmationUrl.searchParams.set('next', nextUrl.toString());
        }

        if (emailType === 'magiclink') {
          actionUrlOverride = nextUrl.toString();
        }
      } catch (error) {
        console.warn(
          'Ignoring invalid redirect_to URL:',
          emailData.redirect_to,
          error
        );
      }
    } else {
      confirmationUrl.searchParams.set('next', emailData.redirect_to);
    }
  }

  const htmlBody = generateEmailHtml(
    config,
    confirmationUrl.toString(),
    branding,
    emailData.token,
    actionUrlOverride
  );

  // Sender: use merchant name for merchant emails, "Baci" for platform emails.
  // The address stays on usebaci.com for SPF/DKIM alignment.
  const senderName =
    branding.businessName !== 'Baci'
      ? branding.emailSenderName || branding.businessName
      : 'Baci';

  console.log(
    'Sending email to:',
    user.email,
    'Type:',
    emailType,
    'Brand:',
    branding.businessName
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
        from: { address: 'noreply@usebaci.com', name: senderName },
        to: [{ email_address: { address: user.email } }],
        subject: config.subject,
        htmlbody: htmlBody,
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
