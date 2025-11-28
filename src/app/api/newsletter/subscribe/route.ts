import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const subscribeSchema = z.object({
  email: z.string().email('Invalid email address'),
  merchantId: z.string().uuid('Invalid merchant ID').optional(),
  source: z.enum(['widget', 'footer', 'checkout', 'popup']).optional().default('widget'),
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
        { error: 'Invalid request', details: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, merchantId, source } = validation.data;
    const normalizedEmail = email.toLowerCase().trim();

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Check if subscriber already exists for this merchant
    const { data: existing } = await supabase
      .from('newsletter_subscribers')
      .select('id, status')
      .eq('email', normalizedEmail)
      .eq('merchant_id', merchantId || '')
      .single();

    if (existing) {
      if (existing.status === 'unsubscribed') {
        // Resubscribe
        await supabase
          .from('newsletter_subscribers')
          .update({
            status: 'subscribed',
            resubscribed_at: new Date().toISOString(),
            source,
          })
          .eq('id', existing.id);

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

    // TODO: Send welcome email with discount code via email service
    // await sendWelcomeEmail(normalizedEmail, merchantId);

    return NextResponse.json({
      success: true,
      message: 'Successfully subscribed! Check your email for your discount code.',
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
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Update subscriber status to unsubscribed
    const { error: updateError } = await supabase
      .from('newsletter_subscribers')
      .update({
        status: 'unsubscribed',
        unsubscribed_at: new Date().toISOString(),
      })
      .eq('email', normalizedEmail)
      .eq('merchant_id', merchantId || '');

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
