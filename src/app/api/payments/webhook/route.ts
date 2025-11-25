import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { verifyPayment } from '@/lib/korapay';
import { logger } from '@/lib/logger';
import { sendEmail } from '@/lib/brevo';
import { generateOrderConfirmationEmail, generateOrderConfirmationText } from '@/lib/email-templates';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    logger.info({ message: 'Payment webhook received', payload: body });

    const { reference, status, event } = body;

    if (!reference) {
      return NextResponse.json({ error: 'Missing reference' }, { status: 400 });
    }

    // Only process successful payment events
    if (event !== 'charge.success' && status !== 'success') {
      logger.info({ message: 'Ignoring non-success webhook event', reference, event, status });
      return NextResponse.json({ message: 'Event ignored' });
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Verify payment with Korapay
    const paymentData = await verifyPayment(reference);

    if (paymentData.status !== 'success') {
      logger.warn({ message: 'Payment verification failed', reference, status: paymentData.status });
      return NextResponse.json({ error: 'Payment not successful' }, { status: 400 });
    }

    // Find transaction record
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('*')
      .eq('gateway_reference', reference)
      .single();

    if (transactionError || !transaction) {
      logger.error({ message: 'Transaction not found', reference, error: transactionError });
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Check if already processed
    if (transaction.status === 'completed') {
      logger.info({ message: 'Transaction already processed', reference });
      return NextResponse.json({ message: 'Already processed' });
    }

    // Update transaction status
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        status: 'completed',
        gateway_response: paymentData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction.id);

    if (updateError) {
      logger.error({ message: 'Failed to update transaction', reference, error: updateError });
      throw updateError;
    }

    // Update order status if order_id exists
    if (transaction.order_id) {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          shipping_status: 'processing',
          updated_at: new Date().toISOString(),
        })
        .eq('id', transaction.order_id)
        .select('*, order_items(*)')
        .single();

      if (orderError) {
        logger.error({ message: 'Failed to update order', orderId: transaction.order_id, error: orderError });
      } else {
        logger.info({ message: 'Order updated successfully', orderId: transaction.order_id });

        // Send order confirmation email
        try {
          const { data: merchantDetails } = await supabase
            .from('merchants')
            .select('business_name, slug')
            .eq('id', transaction.merchant_id)
            .single();

          if (merchantDetails && order.customer_email) {
            const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
            const merchantUrl = `https://${merchantDetails.slug}.${rootDomain}`;

            const emailItems = (order.order_items || []).map((item: Record<string, unknown>) => ({
              name: (item.name as string) || 'Product',
              quantity: (item.quantity as number) || 1,
              price: (item.price as number) || 0,
            }));

            const emailData = {
              orderNumber: order.order_number || order.id.slice(0, 8).toUpperCase(),
              customerName: order.customer_name,
              items: emailItems,
              subtotal: parseFloat(order.subtotal || '0'),
              shippingFee: parseFloat(order.shipping_fee || '0'),
              total: parseFloat(order.total || '0'),
              shippingAddress: {
                address: order.shipping_address?.address || '',
                city: order.shipping_address?.city || '',
                state: order.shipping_address?.state || '',
                phone: order.customer_phone || '',
              },
              merchantName: merchantDetails.business_name,
              merchantUrl,
            };

            const htmlContent = generateOrderConfirmationEmail(emailData);
            const textContent = generateOrderConfirmationText(emailData);

            await sendEmail({
              to: order.customer_email,
              toName: order.customer_name,
              subject: `Order Confirmation - #${emailData.orderNumber}`,
              htmlContent,
              textContent,
            });

            logger.info({ message: 'Order confirmation email sent', orderId: order.id });
          }
        } catch (emailError) {
          logger.error({ message: 'Failed to send order confirmation email', error: emailError });
        }
      }
    }

    // Merchant balance is automatically updated via database trigger

    logger.info({ message: 'Payment processed successfully', reference, transactionId: transaction.id });

    return NextResponse.json({
      success: true,
      message: 'Payment processed successfully',
    });
  } catch (error) {
    logger.error({ message: 'Payment webhook error', error });
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to manually verify a payment
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get('reference');

    if (!reference) {
      return NextResponse.json({ error: 'Missing reference' }, { status: 400 });
    }

    const paymentData = await verifyPayment(reference);

    return NextResponse.json({
      success: true,
      payment: paymentData,
    });
  } catch (error) {
    logger.error({ message: 'Payment verification error', error });
    return NextResponse.json(
      {
        error: 'Verification failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
