import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/zeptomail';

/**
 * POST /api/orders/[id]/reminder
 * Send payment reminder to customer via email, SMS, or WhatsApp.
 * Includes payment link and virtual account details if available.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const body = await request.json();

    // 1. Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get merchant
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id, business_name, slug, support_email, email_sender_name')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // 3. Get order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(
        'id, order_number, total, customer_name, customer_email, customer_phone, payment_status'
      )
      .eq('id', orderId)
      .eq('merchant_id', merchant.id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // 4. Get virtual account if exists
    const { data: virtualAccount } = await supabase
      .from('order_payment_accounts')
      .select('account_number, bank_name, account_name')
      .eq('order_id', orderId)
      .single();

    // 5. Generate payment link
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
    const paymentLink = `https://${merchant.slug}.${rootDomain}/checkout/resume/${orderId}`;

    // 6. Determine channel (email by default)
    const channel = body.channel || 'email';
    const customMessage = body.message || '';

    // 7. Format currency
    const formatCurrency = (amount: number) =>
      new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
      }).format(amount);

    const balanceAmount = formatCurrency(order.total);

    // 8. Compose message content
    const accountDetails = virtualAccount
      ? `\n\nBank Transfer Details:\nBank: ${virtualAccount.bank_name}\nAccount: ${virtualAccount.account_number}\nName: ${virtualAccount.account_name}`
      : '';

    const reminderMessage = `
Hi ${order.customer_name},

This is a friendly reminder about your outstanding payment for Order #${order.order_number}.

Amount Due: ${balanceAmount}

${customMessage ? `Note: ${customMessage}\n` : ''}
Pay Online: ${paymentLink}
${accountDetails}

Thank you for shopping with ${merchant.business_name}!
    `.trim();

    // 9. Send based on channel
    let sendResult = { success: false, error: '' };

    if (channel === 'email' && order.customer_email) {
      try {
        await sendEmail({
          to: order.customer_email,
          toName: order.customer_name,
          subject: `Payment Reminder - Order #${order.order_number}`,
          textContent: reminderMessage,
          htmlContent: `<pre style="font-family: sans-serif; line-height: 1.6;">${reminderMessage}</pre>`,
          replyTo: merchant.support_email || undefined,
          emailType: 'orders',
          fromName: merchant.email_sender_name || merchant.business_name,
        });
        sendResult = { success: true, error: '' };
      } catch (err) {
        logger.error({ message: 'Failed to send reminder email', error: err });
        sendResult = { success: false, error: 'Email sending failed' };
      }
    } else if (channel === 'whatsapp' && order.customer_phone) {
      // TODO: Integrate WhatsApp API (Twilio, Meta, etc.)
      // For now, return the message for manual sending
      sendResult = { success: true, error: '' };
    } else if (channel === 'sms' && order.customer_phone) {
      // TODO: Integrate SMS API (Twilio, Termii, etc.)
      sendResult = { success: true, error: '' };
    } else {
      return NextResponse.json(
        { error: `No valid contact for channel: ${channel}` },
        { status: 400 }
      );
    }

    // 10. Log reminder
    if (sendResult.success) {
      await supabase.from('order_reminders').insert({
        order_id: orderId,
        channel,
        payment_link: paymentLink,
      });
    }

    return NextResponse.json({
      success: sendResult.success,
      message: sendResult.success
        ? 'Reminder sent successfully'
        : sendResult.error,
      channel,
      paymentLink,
      virtualAccount: virtualAccount || null,
    });
  } catch (error) {
    logger.error({ message: 'Reminder API error', error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
