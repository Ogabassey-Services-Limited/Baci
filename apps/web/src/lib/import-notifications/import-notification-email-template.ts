const FONT_STACK = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const HEADER_BG = '#0f0f0f';
const EYEBROW_BG = '#18181b';
const CTA_SHADOW = 'rgba(15,23,42,0.24)';
const CTA_FALLBACK_HTML = `<span style="display:inline-block;color:#b51920;font-family:${FONT_STACK};font-size:14px;font-weight:700;">Receipt link unavailable (invalid link configuration).</span>`;

const DARK_MODE_STYLES = `@media (prefers-color-scheme:dark){
.r-bg{background-color:#0b0b0c!important;}
.r-card{background-color:#161618!important;border-color:#2a2a2e!important;}
.r-logo-chip{background:#ffffff!important;background-color:#ffffff!important;border-color:#ffffff!important;color:#111827!important;}
.r-strong{color:#f4f4f5!important;}
.r-muted{color:#c3c5cc!important;}
.r-faint{color:#8a8d94!important;}
.r-rule{border-color:#2a2a2e!important;}
.r-devrow{background-color:#1c1c1f!important;border-bottom-color:#2a2a2e!important;}
.r-footer{background-color:#161618!important;border-top-color:#2a2a2e!important;}
}`;

/** Convert a 3- or 6-digit hex color to an "r,g,b" string. */
export function hexToRgb(hex: string): string {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const n = Number.parseInt(h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

export interface ReceiptEmailTemplateInput {
  /** Hidden inbox-preview text. Caller must pre-escape any merchant data. */
  preheader: string;
  /** Escaped merchant name. Rendered uppercase via CSS, so case is preserved in source. */
  brandWordmark: string;
  /** Merchant brand color (validated hex) — drives the accent throughout. */
  brandColor: string;
  /**
   * Optional logo URL — caller must sanitize (raster, http/https) AND
   * attribute-escape it. When present it is shown on a white chip in the header
   * (guarantees contrast); otherwise the {@link brandWordmark} text is used.
   */
  logoUrl?: string;
  /** Small uppercase tag shown top-right of the header (rendered as a pill). */
  eyebrow: string;
  headline: string;
  subhead: string;
  /** Escaped recipient name (rendered as "Hello {greetingName},"). */
  greetingName: string;
  /** Intro sentence — caller bakes in the escaped merchant name. */
  introHtml: string;
  sectionLabel: string;
  /** Pre-rendered device rows from {@link renderReceiptDeviceRows}. */
  deviceRowsHtml: string;
  /** Pre-rendered CTA from {@link renderReceiptCta}. */
  ctaHtml: string;
  reassurance: string;
  /** Full support sentence — caller bakes in the escaped contact / mailto link. */
  supportLineHtml: string;
  /** Footer note — caller bakes in the escaped merchant name / tagline. */
  footerNote: string;
}

/** Render the device list rows. Devices must already be HTML-escaped. */
export function renderReceiptDeviceRows(
  escapedDevices: string[],
  brandColor: string
): string {
  return escapedDevices
    .map((device, index) => {
      const isLast = index === escapedDevices.length - 1;
      const border = isLast ? '' : 'border-bottom:1px solid #eef1f5;';
      return `
        <tr>
          <td class="r-devrow" style="padding:16px 18px;${border}background-color:#ffffff;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="30" valign="middle" style="padding-right:14px;">
                  <div style="width:28px;height:28px;background-color:${brandColor};border-radius:8px;color:#ffffff;font-family:${FONT_STACK};font-size:13px;font-weight:700;text-align:center;line-height:28px;">${index + 1}</div>
                </td>
                <td class="r-strong" valign="middle" style="font-family:${FONT_STACK};font-size:15px;font-weight:600;color:#111827;line-height:1.4;">${device}</td>
              </tr>
            </table>
          </td>
        </tr>`;
    })
    .join('');
}

/**
 * Render the call-to-action. `sanitizedUrl` must already be sanitized
 * (`sanitizeUrl`) AND attribute-escaped (`escapeHtmlAttribute`) by the caller —
 * an empty string renders a safe fallback with no link.
 */
export function renderReceiptCta(
  sanitizedUrl: string,
  label: string,
  brandColor: string
): string {
  if (!sanitizedUrl) {
    return CTA_FALLBACK_HTML;
  }
  return `<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${sanitizedUrl}" style="height:52px;v-text-anchor:middle;width:240px;" arcsize="18%" strokecolor="${brandColor}" fillcolor="${brandColor}">
<w:anchorlock/>
<center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${label}</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
<a href="${sanitizedUrl}" class="cta-link" style="display:inline-block;background-color:${brandColor};color:#ffffff;font-family:${FONT_STACK};font-size:16px;font-weight:700;text-decoration:none;padding:16px 36px;border-radius:10px;box-shadow:0 6px 16px ${CTA_SHADOW};mso-padding-alt:0;">${label}</a>
<!--<![endif]-->`;
}

function renderBrandLockup(brandWordmark: string, logoUrl?: string): string {
  if (logoUrl) {
    return `<td valign="middle">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="r-logo-chip" bgcolor="#ffffff" style="background:#ffffff;background-color:#ffffff;border:1px solid #ffffff;border-radius:9px;padding:8px 12px;line-height:0;color:#111827;">
<img src="${logoUrl}" alt="${brandWordmark}" height="22" style="display:block;border:0;outline:none;text-decoration:none;height:22px;width:auto;max-width:220px;background-color:#ffffff;">
</td>
</tr></table>
</td>`;
  }
  return `<td valign="middle" style="font-family:${FONT_STACK};font-size:20px;font-weight:800;letter-spacing:2px;color:#ffffff;line-height:1;text-transform:uppercase;">${brandWordmark}</td>`;
}

/**
 * Render the full responsive, Outlook-safe, dark-mode-aware receipt email
 * shell. All caller inputs that originate from merchant/customer data must be
 * escaped (and URLs sanitized) first.
 */
export function renderReceiptEmailHtml(
  input: ReceiptEmailTemplateInput
): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Your ${input.brandWordmark} receipt</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
${DARK_MODE_STYLES}
@media only screen and (max-width:600px){
.email-card{width:100% !important;border-radius:0 !important;}
.px-pad{padding-left:24px !important;padding-right:24px !important;}
.cta-link{display:block !important;width:100% !important;box-sizing:border-box !important;}
}
</style>
</head>
<body class="r-bg" style="margin:0;padding:0;background-color:#f1f5f9;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<span style="display:none !important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;">${input.preheader}</span>
<table role="presentation" class="r-bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" class="email-card r-card" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.08);border:1px solid #e8edf3;">
<tr>
<td style="background-color:${HEADER_BG};padding:30px 32px 26px 32px;" class="px-pad">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
${renderBrandLockup(input.brandWordmark, input.logoUrl)}
<td valign="middle" align="right"><span style="display:inline-block;background-color:${EYEBROW_BG};border:1px solid ${input.brandColor};border-radius:999px;padding:6px 12px;font-family:${FONT_STACK};font-size:10px;font-weight:700;letter-spacing:1.2px;color:#ffffff;text-transform:uppercase;">${input.eyebrow}</span></td>
</tr></table>
<div style="height:3px;width:44px;background-color:${input.brandColor};border-radius:3px;margin-top:22px;font-size:1px;line-height:3px;">&nbsp;</div>
<div style="font-family:${FONT_STACK};font-size:24px;font-weight:700;color:#ffffff;line-height:1.3;margin-top:16px;">${input.headline}</div>
<div style="font-family:${FONT_STACK};font-size:14px;font-weight:400;color:#b9c0c9;line-height:1.6;margin-top:8px;">${input.subhead}</div>
</td>
</tr>
<tr>
<td style="padding:32px 32px 8px 32px;" class="px-pad">
<p class="r-strong" style="font-family:${FONT_STACK};font-size:16px;font-weight:600;color:#111827;line-height:1.5;margin:0 0 14px 0;">Hello ${input.greetingName},</p>
<p class="r-muted" style="font-family:${FONT_STACK};font-size:15px;font-weight:400;color:#374151;line-height:1.65;margin:0 0 24px 0;">${input.introHtml}</p>
<div class="r-faint" style="font-family:${FONT_STACK};font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#9ca3af;margin:0 0 12px 0;">${input.sectionLabel}</div>
<table role="presentation" class="r-rule" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #eef1f5;border-radius:12px;overflow:hidden;">${input.deviceRowsHtml}</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:30px 0 8px 0;">${input.ctaHtml}</td></tr></table>
<p class="r-muted" style="font-family:${FONT_STACK};font-size:13px;font-weight:400;color:#6b7280;line-height:1.6;text-align:center;margin:14px 0 28px 0;">${input.reassurance}</p>
</td>
</tr>
<tr>
<td class="r-footer px-pad" style="background-color:#f8fafc;border-top:1px solid #eef1f5;padding:24px 32px;">
<p class="r-muted" style="font-family:${FONT_STACK};font-size:13px;font-weight:400;color:#64748b;line-height:1.6;margin:0 0 6px 0;">${input.supportLineHtml}</p>
<p class="r-faint" style="font-family:${FONT_STACK};font-size:12px;font-weight:400;color:#94a3b8;line-height:1.6;margin:0 0 16px 0;">${input.footerNote}</p>
<div class="r-faint" style="font-family:${FONT_STACK};font-size:11px;font-weight:500;letter-spacing:0.4px;color:#b6c0cc;line-height:1.5;">Powered by Baci</div>
</td>
</tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
