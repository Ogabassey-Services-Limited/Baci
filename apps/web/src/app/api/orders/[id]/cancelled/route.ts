import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, getAdminClient, getMerchantIdForApiUser } from '@/lib/api-auth';
import {
    generateOrderCancellationEmail,
    generateOrderCancellationText,
} from '@/lib/email-templates';
import { sendEmail } from '@/lib/zeptomail';
import { logger } from '@/lib/logger';

/**
 * POST /api/orders/[id]/cancelled
 * Sends the "Order Cancelled" email to the customer
 * Called when merchant or customer cancels an order
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        console.log(`[OrderCancelled] Starting for order ${id}`);

        // Parse optional body for cancellation details
        let cancellationReason: string | undefined;
        let cancelledBy: 'merchant' | 'customer' = 'merchant';

        try {
            const body = await request.json();
            cancellationReason = body.reason;
            cancelledBy = body.cancelled_by || 'merchant';
        } catch {
            // No body provided, that's fine
        }

        // Authenticate request
        const { user, error: authError } = await authenticateApiRequest(request);
        if (authError || !user) {
            return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
        }

        // Get merchant ID
        const merchantId = await getMerchantIdForApiUser(user.id);
        if (!merchantId) {
            return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
        }

        const supabase = getAdminClient();

        // Fetch merchant details
        const { data: merchant, error: merchantError } = await supabase
            .from('merchants')
            .select('id, business_name, slug, support_email, email_sender_name, email')
            .eq('id', merchantId)
            .single();

        if (merchantError || !merchant) {
            return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
        }

        // Fetch order with items
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .eq('id', id)
            .eq('merchant_id', merchant.id)
            .single();

        if (orderError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Check if order is actually cancelled
        if (order.shipping_status !== 'cancelled') {
            return NextResponse.json(
                { error: 'Order must be marked as cancelled first' },
                { status: 400 }
            );
        }

        // Calculate refund amount
        const amountPaid = Number(order.amount_paid) || 0;
        // For now, assume full refund of amount paid
        const refundAmount = amountPaid;

        // Prepare email data
        const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
        const merchantUrl = `https://${merchant.slug}.${rootDomain}`;

        const emailItems = order.order_items?.map((item: any) => ({
            name: item.name || 'Product',
            quantity: item.quantity || 1,
            price: item.price || 0,
        })) || [];

        const cancellationData = {
            orderNumber: order.order_number || order.id.slice(0, 8).toUpperCase(),
            customerName: order.customer_name,
            items: emailItems,
            totalAmount: Number(order.total) || 0,
            amountPaid,
            refundAmount,
            cancellationReason,
            cancelledBy,
            merchantName: merchant.business_name,
            merchantUrl,
            supportEmail: merchant.support_email,
        };

        const htmlContent = generateOrderCancellationEmail(cancellationData);
        const textContent = generateOrderCancellationText(cancellationData);

        const replyToEmail = merchant.support_email || merchant.email || `support@${merchant.slug}.${rootDomain}`;
        const senderName = merchant.email_sender_name
            ? `${merchant.email_sender_name}`
            : `${merchant.business_name}`;

        // Send email
        const emailResult = await sendEmail({
            to: order.customer_email,
            toName: order.customer_name,
            subject: `Order #${cancellationData.orderNumber} Has Been Cancelled`,
            htmlContent,
            textContent,
            replyTo: replyToEmail,
            emailType: 'orders',
            fromName: senderName,
        });

        if (!emailResult.success) {
            logger.error({ message: 'Failed to send cancellation email', error: emailResult.error });
            return NextResponse.json(
                { error: 'Failed to send email', details: emailResult.error },
                { status: 500 }
            );
        }

        console.log(`[OrderCancelled] Email sent for order ${id}`);

        return NextResponse.json({
            success: true,
            message: 'Cancellation notification sent',
            messageId: emailResult.messageId,
        });

    } catch (error: any) {
        console.error('Error in cancellation notification:', error);
        logger.error({ message: 'Error sending cancellation email', error });
        return NextResponse.json(
            { error: error.message || 'Internal Error' },
            { status: 500 }
        );
    }
}
