import { after, type NextRequest, NextResponse } from 'next/server';
import { sanitizeText } from '@/lib/sanitize-core';
import { createAnonClient } from '@/lib/supabase/anon';
import { sendEmail } from '@/lib/zeptomail';
import { syncZohoNewsletterSubscriber } from '@/lib/zoho-newsletter-subscription';
import { subscribeSchema, unsubscribeSchema } from '@/schemas/newsletter';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function scheduleZohoNewsletterSync({
  email,
  merchantId,
  source,
}: {
  email: string;
  merchantId?: string | null;
  source: string;
}) {
  after(() => {
    syncZohoNewsletterSubscriber({
      email,
      merchantId,
      source,
    }).then((result) => {
      if (result.status === 'failed') {
        console.error('Zoho newsletter subscriber sync failed:', result.error);
      }
    });
  });
}

/**
 * POST /api/newsletter/subscribe
 * Subscribe an email to a merchant's newsletter
 *
 * CSRF exemption: This is a public endpoint for anonymous storefront visitors.
 * Guest users do not have CSRF tokens. Abuse is mitigated by rate limiting
 * in proxy.ts middleware and the RPC's idempotent upsert behavior.
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    const validation = subscribeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { email, merchantId, source } = validation.data;
    const normalizedEmail = email.toLowerCase().trim();

    const supabase = createAnonClient();

    const { data: subscribeResult, error: subscribeError } = await supabase.rpc(
      'subscribe_newsletter',
      {
        p_email: normalizedEmail,
        p_merchant_id: merchantId || null,
        p_source: source,
      }
    );

    if (subscribeError) {
      console.error('Newsletter subscription error:', subscribeError);
      return NextResponse.json(
        { error: 'Failed to subscribe. Please try again.' },
        { status: 500 }
      );
    }

    // Type guard for RPC result
    const validResults: string[] = [
      'already_subscribed',
      'resubscribed',
      'subscribed',
    ];
    if (!subscribeResult || !validResults.includes(subscribeResult as string)) {
      console.error('Unexpected subscribe_newsletter result:', subscribeResult);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }

    if (subscribeResult === 'already_subscribed') {
      return NextResponse.json({
        success: true,
        message: 'You are already subscribed.',
      });
    }

    if (subscribeResult === 'resubscribed') {
      scheduleZohoNewsletterSync({
        email: normalizedEmail,
        merchantId,
        source,
      });
      // Intentionally skip welcome email for resubscribed users — they already received one.
      // Consider adding a "welcome back" email if re-engagement metrics warrant it.
      return NextResponse.json({
        success: true,
        message: 'Welcome back! You have been resubscribed.',
      });
    }

    // Get merchant info for personalized email
    let merchantName = 'Baci';
    if (merchantId) {
      const { data: merchant, error: merchantError } = await supabase
        .from('merchants')
        .select('business_name')
        .eq('id', merchantId)
        .single();
      if (merchantError) {
        console.warn('Could not fetch merchant name:', merchantError.message);
      }
      if (merchant?.business_name) {
        merchantName = sanitizeText(merchant.business_name);
      }
    }

    const response = NextResponse.json({
      success: true,
      message:
        'Successfully subscribed! Check your email for a welcome message.',
    });

    after(() => {
      sendEmail({
        to: normalizedEmail,
        subject: `Welcome to ${merchantName}!`,
        htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #6366f1; margin: 0;">Welcome!</h1>
          </div>
          <p>Thanks for subscribing to <strong>${escapeHtml(merchantName)}</strong>'s newsletter!</p>
          <p>You'll be the first to know about:</p>
          <ul style="padding-left: 20px;">
            <li>New product launches</li>
            <li>Exclusive discounts and offers</li>
            <li>Special promotions</li>
          </ul>
          <p>Stay tuned for exciting updates!</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 12px; color: #666; text-align: center;">
            You received this email because you subscribed to ${escapeHtml(merchantName)}'s newsletter.
          </p>
        </body>
        </html>
      `,
        textContent: `Welcome to ${merchantName}!\n\nThanks for subscribing to our newsletter. You'll be the first to know about new product launches, exclusive discounts, and special promotions.\n\nStay tuned for exciting updates!`,
        emailType: 'newsletter',
        fromName: merchantName,
      }).catch((err) => console.error('Newsletter welcome email error:', err));
      syncZohoNewsletterSubscriber({
        email: normalizedEmail,
        merchantId,
        source,
      }).then((result) => {
        if (result.status === 'failed') {
          console.error(
            'Zoho newsletter subscriber sync failed:',
            result.error
          );
        }
      });
    });

    return response;
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/newsletter/subscribe
 * Unsubscribe an email from a merchant's newsletter.
 *
 * CSRF exemption: Called from unsubscribe links in emails by anonymous users.
 * Guest users do not have CSRF tokens. Abuse is mitigated by rate limiting
 * in proxy.ts and the RPC's idempotent behavior.
 */
export async function DELETE(request: NextRequest) {
  try {
    // CSRF exemption: Unsubscribe is a public endpoint for anonymous users.
    // Use request body to avoid PII in URL logs.
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const validation = unsubscribeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { email, merchantId } = validation.data;
    const normalizedEmail = email.toLowerCase().trim();

    const supabase = createAnonClient();

    const { error: unsubscribeError } = await supabase.rpc(
      'unsubscribe_newsletter',
      {
        p_email: normalizedEmail,
        p_merchant_id: merchantId || null,
      }
    );

    if (unsubscribeError) {
      console.error('Newsletter unsubscribe error:', unsubscribeError);
      return NextResponse.json(
        { error: 'Failed to unsubscribe. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'You have been unsubscribed.',
    });
  } catch (error) {
    console.error('Newsletter unsubscribe error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
