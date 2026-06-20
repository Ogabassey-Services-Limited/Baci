import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { escapeHtmlAttribute } from '@/lib/sanitize';
import { isValidUuid, sanitizeText } from '@/lib/sanitize-core';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/zeptomail';

export async function POST(request: NextRequest) {
  try {
    // CSRF: handled by Origin-based middleware in proxy.ts (guest storefront route)
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const body = await request.json();

    const { merchantId, formName, formData } = body;

    // Validate required fields
    if (!merchantId || !formName || !formData) {
      return NextResponse.json(
        { error: 'Missing required fields: merchantId, formName, or formData' },
        { status: 400 }
      );
    }

    // Validate merchantId is a valid UUID to prevent injection
    if (!isValidUuid(merchantId)) {
      return NextResponse.json(
        { error: 'Invalid merchant ID format' },
        { status: 400 }
      );
    }

    // Validate merchant exists and get their email
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id, business_name, email, support_email')
      .eq('id', merchantId)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Invalid merchant ID' },
        { status: 400 }
      );
    }

    // Use support_email (customer-facing) first, fall back to merchant account email
    const merchantEmail = merchant.support_email || merchant.email || null;

    // Get IP address and user agent
    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Sanitize form data before storing (prevent XSS and clean user input)
    // Using Object.create(null) prevents prototype pollution
    // Explicitly filtering dangerous keys (redundant but safe)
    // nosemgrep: javascript.lang.security.audit.prototype-pollution.assignment-to-proto
    const sanitizedFormData: Record<string, string> = Object.create(null);
    // Allowlist of valid field name patterns - only allow alphanumeric and common form field characters
    const VALID_KEY_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_\-\s]*$/;
    for (const [key, value] of Object.entries(formData)) {
      const sanitizedKey = sanitizeText(String(key), 100);
      const sanitizedValue = sanitizeText(String(value ?? ''), 10000);

      // Block keys that could be used for prototype pollution
      // Also validate against allowlist pattern for additional security
      if (
        sanitizedKey &&
        sanitizedKey !== '__proto__' &&
        sanitizedKey !== 'constructor' &&
        sanitizedKey !== 'prototype' &&
        VALID_KEY_PATTERN.test(sanitizedKey)
      ) {
        // codeql[js/property-injection]: Key is validated against allowlist pattern and sanitized
        Object.defineProperty(sanitizedFormData, sanitizedKey, {
          value: sanitizedValue,
          writable: true,
          enumerable: true,
          configurable: false,
        });
      }
    }

    // Insert form submission with sanitized data
    const { data: submission, error: submitError } = await supabase
      .from('form_submissions')
      .insert({
        merchant_id: merchantId,
        form_name: sanitizeText(formName, 100),
        form_data: sanitizedFormData,
        ip_address: ip,
        user_agent: userAgent,
        status: 'unread',
      })
      .select()
      .single();

    if (submitError) {
      console.error('Error saving form submission:', submitError);
      return NextResponse.json(
        { error: 'Failed to save form submission' },
        { status: 500 }
      );
    }

    // Send email notification to merchant (fire and forget)
    if (merchantEmail) {
      // Escape HTML to prevent XSS in email content
      const formDataRows = Object.entries(formData)
        .map(
          ([key, value]) =>
            `<tr><td style="padding: 8px; border: 1px solid #eee; font-weight: 500;">${escapeHtmlAttribute(String(key))}</td><td style="padding: 8px; border: 1px solid #eee;">${escapeHtmlAttribute(String(value ?? ''))}</td></tr>`
        )
        .join('');

      const textFormData = Object.entries(formData)
        .map(
          ([key, value]) =>
            `${sanitizeText(String(key))}: ${sanitizeText(String(value ?? ''))}`
        )
        .join('\n');

      sendEmail({
        to: merchantEmail,
        toName: merchant.business_name,
        subject: `New ${formName} submission on ${merchant.business_name}`,
        htmlContent: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    </head>
                    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: #6366f1; margin: 0;">New Form Submission</h1>
                        </div>
                        <p>You received a new <strong>${formName}</strong> submission on your store.</p>
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <thead>
                                <tr style="background: #f9fafb;">
                                    <th style="padding: 8px; border: 1px solid #eee; text-align: left;">Field</th>
                                    <th style="padding: 8px; border: 1px solid #eee; text-align: left;">Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${formDataRows}
                            </tbody>
                        </table>
                        <p style="font-size: 12px; color: #666;">
                            Submitted at: ${new Date().toLocaleString()}
                        </p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                        <p style="font-size: 12px; color: #666; text-align: center;">
                            This notification was sent by Baci for ${merchant.business_name}.
                        </p>
                    </body>
                    </html>
                `,
        textContent: `New ${formName} submission on ${merchant.business_name}\n\n${textFormData}\n\nSubmitted at: ${new Date().toLocaleString()}`,
        emailType: 'notifications',
      }).catch((err) => console.error('Form notification email error:', err));
    }

    return NextResponse.json({
      success: true,
      message: 'Form submitted successfully',
      submissionId: submission.id,
    });
  } catch (error) {
    console.error('Form submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
