const FONT_STACK = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const BACI_LOGO_URL =
  'https://aivqthbxdshhltbwipbr.supabase.co/storage/v1/object/public/media/platform/baci-logo.png';
const BACI_PRIMARY_COLOR = '#1e40af';
const BACI_BUTTON_COLOR = '#fbbf24';
const BACI_BUTTON_TEXT_COLOR = '#1e1e1e';
const OGABASSEY_COLOR = '#d62027';
const PLATFORM_DOMAIN = 'usebaci.com';
const RESERVED_BACI_SUBDOMAINS = new Set(['app', 'dashboard', 'www']);

export interface EmailConfig {
  subject: string;
  heading: string;
  body: string;
  buttonText: string;
}

export interface MerchantBranding {
  businessName: string;
  customDomain?: string | null;
  emailSenderName?: string | null;
  logoUrl: string | null;
  primaryColor: string;
  buttonColor: string;
  buttonTextColor: string;
  slug?: string | null;
  supportEmail?: string | null;
}

export interface MerchantLookup {
  customDomain: string | null;
  slug: string | null;
}

export const BACI_BRANDING: MerchantBranding = {
  businessName: 'Baci',
  logoUrl: BACI_LOGO_URL,
  primaryColor: BACI_PRIMARY_COLOR,
  buttonColor: BACI_BUTTON_COLOR,
  buttonTextColor: BACI_BUTTON_TEXT_COLOR,
};

export function getEmailConfig(
  emailType: string,
  brandName: string
): EmailConfig {
  const configs: Record<string, EmailConfig> = {
    signup: {
      subject: `Confirm your ${brandName} account`,
      heading: 'Verify your email address',
      body: `Thanks for joining ${brandName}. Confirm your email address to activate your account.`,
      buttonText: 'Confirm email',
    },
    signup_confirmation: {
      subject: `Confirm your ${brandName} account`,
      heading: 'Verify your email address',
      body: `Thanks for joining ${brandName}. Confirm your email address to activate your account.`,
      buttonText: 'Confirm email',
    },
    invite: {
      subject: `You've been invited to ${brandName}`,
      heading: "You've been invited",
      body: `You have been invited to join ${brandName}. Use the button below to set up your account.`,
      buttonText: 'Accept invitation',
    },
    magiclink: {
      subject: `Your ${brandName} sign-in code`,
      heading: 'Your sign-in code',
      body: `Use this secure code to continue to your ${brandName} account. The code expires shortly.`,
      buttonText: `Open ${brandName}`,
    },
    recovery: {
      subject: `Reset your ${brandName} password`,
      heading: 'Reset your password',
      body: 'We received a request to reset your password. Use the button below to choose a new one.',
      buttonText: 'Reset password',
    },
    email_change: {
      subject: 'Confirm your new email address',
      heading: 'Confirm email change',
      body: 'Please confirm the update of your email address by clicking the button below.',
      buttonText: 'Confirm new email',
    },
    reauthentication: {
      subject: 'Security verification required',
      heading: 'Security verification',
      body: 'A sensitive action was requested on your account. Please verify your identity to proceed.',
      buttonText: 'Verify identity',
    },
  };

  return configs[emailType] || configs.signup;
}

function normalizeHostname(hostname: string): string | null {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (!normalized || normalized.includes('/') || normalized.includes(':')) {
    return null;
  }

  return normalized;
}

function parseUrlHost(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;

  try {
    return normalizeHostname(new URL(rawUrl).hostname);
  } catch {
    return null;
  }
}

function extractBaciSlug(hostname: string): string | null {
  if (
    hostname === PLATFORM_DOMAIN ||
    hostname === `www.${PLATFORM_DOMAIN}` ||
    !hostname.endsWith(`.${PLATFORM_DOMAIN}`)
  ) {
    return null;
  }

  const subdomain = hostname.slice(0, -1 * `.${PLATFORM_DOMAIN}`.length);
  const firstLabel = subdomain.split('.')[0]?.toLowerCase();
  if (!firstLabel || RESERVED_BACI_SUBDOMAINS.has(firstLabel)) {
    return null;
  }

  return firstLabel;
}

function isPlatformHost(hostname: string): boolean {
  return (
    hostname === PLATFORM_DOMAIN ||
    hostname.endsWith(`.${PLATFORM_DOMAIN}`) ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.vercel.app')
  );
}

export function extractMerchantLookup(
  ...candidateUrls: Array<string | null | undefined>
): MerchantLookup | null {
  for (const candidateUrl of candidateUrls) {
    const hostname = parseUrlHost(candidateUrl);
    if (!hostname) continue;

    const slug = extractBaciSlug(hostname);
    if (slug) {
      return { customDomain: null, slug };
    }

    if (!isPlatformHost(hostname)) {
      return { customDomain: hostname, slug: null };
    }
  }

  return null;
}

export function getCustomDomainCandidates(
  customDomain: string | null | undefined
): string[] {
  const normalized = customDomain ? normalizeHostname(customDomain) : null;
  if (!normalized) return [];

  if (normalized.startsWith('www.')) {
    return [normalized, normalized.slice(4)];
  }

  return [normalized, `www.${normalized}`];
}

export function sanitizeUrl(url: string): string {
  if (!url) return '';

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.href;
  } catch {
    return '';
  }
}

export function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeHexColor(value: string, fallback: string): string {
  return /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value) ? value : fallback;
}

function hexToRgb(hex: string): string {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((char) => char + char)
      .join('');
  }
  const n = Number.parseInt(h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function isOgabasseyBrand(branding: MerchantBranding): boolean {
  const identity = [
    branding.businessName,
    branding.slug ?? '',
    branding.customDomain ?? '',
  ]
    .join(' ')
    .toLowerCase();

  return identity.includes('ogabassey');
}

function renderLogo(branding: MerchantBranding, safeBrandName: string): string {
  const safeLogoUrl = sanitizeUrl(branding.logoUrl ?? '');
  if (!safeLogoUrl) {
    return `<span class="a-brand-logo" style="display:inline-block;max-width:100%;font-family:${FONT_STACK};font-size:20px;font-weight:800;letter-spacing:2px;color:#ffffff;text-transform:uppercase;">${safeBrandName}</span>`;
  }

  return `<span class="a-brand-logo" style="display:inline-block;max-width:100%;background:#ffffff;border-radius:10px;padding:8px 12px;line-height:0;"><img src="${escapeHtml(safeLogoUrl)}" alt="${safeBrandName}" height="24" style="display:block;border:0;height:24px;width:auto;max-width:220px;"></span>`;
}

function renderTokenBlock(
  token: string | undefined,
  brandColor: string
): string {
  if (!token) return '';

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 22px 0;">
<tr><td align="center">
<div style="display:inline-block;background:#fff7f7;border:1px solid rgba(${hexToRgb(brandColor)},0.24);border-radius:14px;padding:16px 22px;">
<span style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;font-size:32px;font-weight:800;letter-spacing:8px;color:${brandColor};line-height:1;">${escapeHtml(token)}</span>
</div>
<p style="font-family:${FONT_STACK};font-size:12px;color:#6b7280;line-height:1.5;margin:10px 0 0 0;">Enter this 6-digit code on the sign-in page.</p>
</td></tr>
</table>`;
}

function renderButton(url: string, label: string, color: string): string {
  if (!url) return '';

  return `<a href="${escapeHtml(url)}" style="display:inline-block;background-color:${color};color:#ffffff;font-family:${FONT_STACK};font-size:15px;font-weight:800;text-decoration:none;padding:15px 30px;border-radius:10px;box-shadow:0 8px 20px rgba(${hexToRgb(color)},0.26);">${escapeHtml(label)}</a>`;
}

function renderOgabasseyEmailHtml(
  config: EmailConfig,
  actionUrl: string,
  branding: MerchantBranding,
  token?: string
): string {
  const safeBrandName = escapeHtml(branding.businessName);
  const brandColor = normalizeHexColor(branding.primaryColor, OGABASSEY_COLOR);
  const support = branding.supportEmail || 'support@ogabassey.com';
  const safeSupport = escapeHtml(support);
  const supportHtml = support.includes('@')
    ? `<a href="mailto:${safeSupport}" style="color:${brandColor};font-weight:700;text-decoration:none;">${safeSupport}</a>`
    : safeSupport;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(config.subject)}</title>
<style>
@media (prefers-color-scheme:dark){
.a-bg{background:#0b0b0c!important}.a-card{background:#161618!important;border-color:#2a2a2e!important}.a-strong{color:#f4f4f5!important}.a-muted{color:#c3c5cc!important}.a-footer{background:#101012!important;border-color:#2a2a2e!important}
}
@media only screen and (max-width:600px){.a-card{width:100%!important;border-radius:0!important}.a-pad{padding-left:24px!important;padding-right:24px!important}.a-cta{display:block!important;width:100%!important;box-sizing:border-box!important}.a-brand-cell,.a-badge-cell{display:block!important;width:100%!important;text-align:left!important}.a-badge-cell{padding-top:14px!important}.a-brand-logo img{height:auto!important;max-width:180px!important}.a-badge{display:inline-block!important;white-space:normal!important;max-width:100%!important}}
</style>
</head>
<body class="a-bg" style="margin:0;padding:0;background:#f2f4f7;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;">${escapeHtml(config.body)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="a-bg" style="background:#f2f4f7;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="a-card" style="width:600px;max-width:600px;background:#ffffff;border:1px solid #e8edf3;border-radius:18px;overflow:hidden;box-shadow:0 12px 32px rgba(15,23,42,0.10);">
<tr><td class="a-pad" style="background:#101010;padding:30px 34px 28px 34px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="a-brand-cell" valign="middle">${renderLogo(branding, safeBrandName)}</td>
<td class="a-badge-cell" valign="middle" align="right"><span class="a-badge" style="display:inline-block;border:1px solid ${brandColor};background:rgba(${hexToRgb(brandColor)},0.16);border-radius:999px;padding:7px 12px;font-family:${FONT_STACK};font-size:10px;font-weight:800;letter-spacing:1.2px;color:#ffffff;text-transform:uppercase;">Secure sign in</span></td>
</tr></table>
<div style="height:3px;width:46px;background:${brandColor};border-radius:4px;margin-top:24px;font-size:1px;line-height:3px;">&nbsp;</div>
<h1 style="font-family:${FONT_STACK};font-size:25px;font-weight:800;color:#ffffff;line-height:1.25;margin:17px 0 0 0;">${escapeHtml(config.heading)}</h1>
<p style="font-family:${FONT_STACK};font-size:14px;font-weight:400;color:#bdc3cc;line-height:1.65;margin:9px 0 0 0;">${escapeHtml(config.body)}</p>
</td></tr>
<tr><td class="a-pad" style="padding:32px 34px 10px 34px;">
<p class="a-strong" style="font-family:${FONT_STACK};font-size:16px;font-weight:700;color:#111827;line-height:1.5;margin:0 0 8px 0;">Hello,</p>
<p class="a-muted" style="font-family:${FONT_STACK};font-size:15px;font-weight:400;color:#374151;line-height:1.65;margin:0;">Use this one-time code to continue to your ${safeBrandName} account. Keep it private and do not share it with anyone.</p>
${renderTokenBlock(token, brandColor)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:4px 0 22px 0;">${renderButton(actionUrl, config.buttonText, brandColor)}</td></tr></table>
<p class="a-muted" style="font-family:${FONT_STACK};font-size:13px;color:#6b7280;line-height:1.6;text-align:center;margin:0 0 24px 0;">If you did not request this email, you can safely ignore it.</p>
</td></tr>
<tr><td class="a-footer a-pad" style="background:#f8fafc;border-top:1px solid #eef1f5;padding:23px 34px;">
<p class="a-muted" style="font-family:${FONT_STACK};font-size:13px;color:#64748b;line-height:1.6;margin:0 0 8px 0;">Need help? Contact ${supportHtml}.</p>
<p style="font-family:${FONT_STACK};font-size:12px;color:#9ca3af;line-height:1.6;margin:0;">${safeBrandName} Never Disappoints.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function renderDefaultEmailHtml(
  config: EmailConfig,
  actionUrl: string,
  branding: MerchantBranding,
  token?: string
): string {
  const safeHeading = escapeHtml(config.heading);
  const safeBody = escapeHtml(config.body);
  const safeButtonText = escapeHtml(config.buttonText);
  const safeUrl = escapeHtml(actionUrl);
  const safeBrandName = escapeHtml(branding.businessName);
  const primaryColor = normalizeHexColor(
    branding.primaryColor,
    BACI_PRIMARY_COLOR
  );
  const buttonColor = normalizeHexColor(
    branding.buttonColor,
    BACI_BUTTON_COLOR
  );
  const buttonTextColor = normalizeHexColor(
    branding.buttonTextColor,
    BACI_BUTTON_TEXT_COLOR
  );
  const headerContent = renderLogo(branding, safeBrandName);
  const tokenHtml = renderTokenBlock(token, primaryColor);
  const isMerchantBranded = branding.businessName !== 'Baci';
  const footerText = isMerchantBranded
    ? `&copy; ${new Date().getFullYear()} ${safeBrandName}. Powered by <strong>Baci</strong>.`
    : `&copy; ${new Date().getFullYear()} Baci Platform. All rights reserved.`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:${FONT_STACK};background-color:#f8fafc;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
<tr><td style="background:linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 100%);padding:32px;text-align:center;">${headerContent}</td></tr>
<tr><td style="padding:40px 32px;color:#334155;">
<h1 style="margin:0 0 16px;font-size:24px;color:#0f172a;">${safeHeading}</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.6;">${safeBody}</p>
${tokenHtml}
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:16px 0 32px;"><a href="${safeUrl}" style="display:inline-block;background-color:${buttonColor};color:${buttonTextColor};font-weight:600;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:16px;">${safeButtonText}</a></td></tr></table>
<p style="margin:0;font-size:14px;color:#64748b;">If you didn't request this, you can safely ignore this email.</p>
</td></tr>
<tr><td style="padding:24px 32px;text-align:center;background-color:#f1f5f9;border-top:1px solid #e2e8f0;"><p style="margin:0;font-size:12px;color:#94a3b8;">${footerText}</p></td></tr>
</table>
</td></tr></table>
</body>
</html>`;
}

export function generateEmailHtml(
  config: EmailConfig,
  confirmationUrl: string,
  branding: MerchantBranding,
  token?: string,
  actionUrlOverride?: string
): string {
  const actionUrl = sanitizeUrl(actionUrlOverride || confirmationUrl);
  if (isOgabasseyBrand(branding)) {
    return renderOgabasseyEmailHtml(config, actionUrl, branding, token);
  }

  return renderDefaultEmailHtml(config, actionUrl, branding, token);
}
