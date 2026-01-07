import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServiceRoleKey, getSupabaseUrl } from '@/env';
import { sendEmail } from '@/lib/zeptomail';

const subscribeSchema = z.object({
  email: z.string().email('Invalid email address'),
  merchantId: z.string().uuid('Invalid merchant ID').optional(),
  source: z
    .enum(['widget', 'footer', 'checkout', 'popup'])
    .optional()
    .default('widget'),
});

/**
 * POST /api/newsletter/subscribe
 * Subscribe an email to a merchant's newsletter
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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

    // Use Service Role Key to bypass RLS policies
    const supabase = createSupabaseClient(
      getSupabaseUrl(),
      getSupabaseServiceRoleKey(),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );

    // Check if subscriber already exists for this merchant
    let query = supabase
      .from('newsletter_subscribers')
      .select('id, status')
      .eq('email', normalizedEmail);

    if (merchantId) {
      query = query.eq('merchant_id', merchantId);
    } else {
      query = query.is('merchant_id', null);
    }

    const { data: existing } = await query.single();

    if (existing) {
      if (existing.status === 'unsubscribed') {
        // Resubscribe
        const { error: updateError } = await supabase
          .from('newsletter_subscribers')
          .update({
            status: 'subscribed',
            resubscribed_at: new Date().toISOString(),
            source,
          })
          .eq('id', existing.id);

        if (updateError) {
          console.error('Newsletter resubscribe error:', updateError);
          return NextResponse.json(
            { error: 'Failed to resubscribe. Please try again.' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Welcome back! You have been resubscribed.',
        });
      }

      return NextResponse.json({
        success: true,
        message: 'You are already subscribed.',
      });
    }

    // Create new subscriber
    const { error: insertError } = await supabase
      .from('newsletter_subscribers')
      .insert({
        email: normalizedEmail,
        merchant_id: merchantId || null,
        source,
        status: 'subscribed',
        subscribed_at: new Date().toISOString(),
      });

    if (insertError) {
      // Handle unique constraint violation gracefully
      if (insertError.code === '23505') {
        return NextResponse.json({
          success: true,
          message: 'You are already subscribed.',
        });
      }

      console.error('Newsletter subscription error:', insertError);
      return NextResponse.json(
        { error: 'Failed to subscribe. Please try again.' },
        { status: 500 }
      );
    }

    // Get merchant info for personalized email
    let merchantName = 'Baci';
    if (merchantId) {
      const { data: merchant } = await supabase
        .from('merchants')
        .select('business_name')
        .eq('id', merchantId)
        .single();
      if (merchant?.business_name) {
        merchantName = merchant.business_name;
      }
    }

    // Send welcome email (fire and forget)
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
          <p>Thanks for subscribing to <strong>${merchantName}</strong>'s newsletter!</p>
          <p>You'll be the first to know about:</p>
          <ul style="padding-left: 20px;">
            <li>New product launches</li>
            <li>Exclusive discounts and offers</li>
            <li>Special promotions</li>
          </ul>
          <p>Stay tuned for exciting updates!</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 12px; color: #666; text-align: center;">
            You received this email because you subscribed to ${merchantName}'s newsletter.
          </p>
        </body>
        </html>
      `,
      textContent: `Welcome to ${merchantName}!\n\nThanks for subscribing to our newsletter. You'll be the first to know about new product launches, exclusive discounts, and special promotions.\n\nStay tuned for exciting updates!`,
      emailType: 'newsletter',
      fromName: merchantName,
    }).catch((err) => console.error('Newsletter welcome email error:', err));

    return NextResponse.json({
      success: true,
      message:
        'Successfully subscribed! Check your email for a welcome message.',
    });
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
 * Unsubscribe an email from a merchant's newsletter
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const merchantId = searchParams.get('merchantId');
    const _token = searchParams.get('token'); // For secure unsubscribe links (reserved for future use)

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Use Service Role Key to bypass RLS policies
    const supabase = createSupabaseClient(
      getSupabaseUrl(),
      getSupabaseServiceRoleKey(),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );

    // Update subscriber status to unsubscribed
    let query = supabase
      .from('newsletter_subscribers')
      .update({
        status: 'unsubscribed',
        unsubscribed_at: new Date().toISOString(),
      })
      .eq('email', normalizedEmail);

    if (merchantId) {
      query = query.eq('merchant_id', merchantId);
    } else {
      query = query.is('merchant_id', null);
    }

    const { error: updateError } = await query;

    if (updateError) {
      console.error('Newsletter unsubscribe error:', updateError);
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
