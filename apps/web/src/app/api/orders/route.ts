'use server';

import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import {
  generateOrderConfirmationEmail,
  generateOrderConfirmationText,
} from '@/lib/email-templates';
import { detectPrivacyRegion } from '@/lib/geo-privacy';
import { createGiglShipment } from '@/lib/gigl';
import { logger } from '@/lib/logger';
import {
  isValidUuid,
  sanitizeLikePattern,
  sanitizeSearchQuery,
} from '@/lib/sanitize-core';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendEmail } from '@/lib/zeptomail';

// GIGL-specific shipment creation logic is now in its own function
interface OrderItem {
  value: number;
  quantity: number;
  product_id?: string;
  productId?: string;
  id?: string;
  name?: string;
  productName?: string;
  price?: number;
}

interface CustomerInfo {
  name: string;
  phone: string;
}

interface ShippingAddress {
  address: string;
}

// GIGL-specific shipment creation logic is now in its own function
async function handleGiglShipment(
  order: { items: OrderItem[] },
  customer: CustomerInfo,
  shippingAddress: ShippingAddress
) {
  try {
    const giglShipmentPayload = {
      SenderDetails: {
        SenderLocation: { Latitude: '6.5244', Longitude: '3.3792' },
        SenderName: 'Baci Store',
        SenderPhoneNumber: '+234800000000',
        SenderStationId: 4,
        SenderAddress: 'Merchant Address',
        InputtedSenderAddress: 'Merchant Address',
        SenderLocality: 'Lagos',
      },
      ReceiverDetails: {
        ReceiverLocation: { Longitude: '3.3792', Latitude: '6.5244' },
        ReceiverStationId: 4,
        ReceiverName: customer.name,
        ReceiverPhoneNumber: customer.phone,
        ReceiverAddress: shippingAddress.address,
        InputtedReceiverAddress: shippingAddress.address,
      },
      ShipmentDetails: { VehicleType: 1, IsFromAgility: 0, IsBatchPickUp: 0 },
      ShipmentItems: order.items.map(
        (item: { value: number; quantity: number }) => ({
          SpecialPackageId: 10,
          Quantity: item.quantity,
          Value: item.value,
          ShipmentType: 0, // Special
        })
      ),
    };
    const giglResult = await createGiglShipment(giglShipmentPayload);
    if (giglResult.status === 200 && giglResult.data.Waybill) {
      logger.info({
        message: 'GIGL shipment created successfully',
        waybill: giglResult.data.Waybill,
      });
      return {
        shipping_provider: 'GIGL',
        tracking_number: giglResult.data.Waybill,
      };
    } else {
      logger.error({ message: 'GIGL shipment creation failed', giglResult });
      return null;
    }
  } catch (giglError) {
    logger.error({
      message: 'Error calling GIGL create shipment API',
      error: giglError,
    });
    return null;
  }
}

// GET /api/orders - Fetch orders for authenticated merchant
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('API: Auth error or no user', authError);
      return NextResponse.json(
        { error: 'Unauthorized: You must be logged in to fetch orders.' },
        { status: 401 }
      );
    }

    // Get merchant record
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      console.error('API: Merchant not found for user', {
        userId: user.id,
        merchantError,
      });
      return NextResponse.json(
        { error: 'Merchant not found for the authenticated user.' },
        { status: 404 }
      );
    }

    // Get search params for filtering
    const { searchParams } = new URL(request.url);
    const paymentStatus = searchParams.get('payment_status');
    const shippingStatus = searchParams.get('shipping_status');
    const searchRaw = searchParams.get('search');

    // Sanitize search input
    const search = searchRaw ? sanitizeSearchQuery(searchRaw) : null;

    // Build query
    let query = supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false });

    // Apply filters
    if (paymentStatus && paymentStatus !== 'all') {
      query = query.eq('payment_status', paymentStatus);
    }

    if (shippingStatus && shippingStatus !== 'all') {
      query = query.eq('shipping_status', shippingStatus);
    }

    // Search by customer name or order number (with sanitized input)
    if (search?.trim()) {
      const sanitizedPattern = sanitizeLikePattern(search);
      query = query.or(
        `customer_name.ilike.%${sanitizedPattern}%,order_number.ilike.%${sanitizedPattern}%`
      );
    }

    const { data: orders, error: ordersError } = await query;

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return NextResponse.json(
        { error: 'Failed to fetch orders from the database.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ orders: orders || [] });
  } catch (error) {
    console.error('Unexpected error in GET /api/orders:', error);
    return NextResponse.json(
      { error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}

// POST /api/orders - Create new order from storefront
export async function POST(request: NextRequest) {
  try {
    // Use service role client for order creation to bypass RLS (storefront guests can't insert orders)
    const supabase = createServiceClient();
    const body = await request.json();

    // Capture IP and User Agent for enhanced ad tracking (improves Event Match Quality)
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      undefined;
    const clientUserAgent = request.headers.get('user-agent') || undefined;

    // Detect privacy region for CCPA/GDPR compliance (LDU flag)
    const geoPrivacy = await detectPrivacyRegion(clientIp);

    const {
      merchant_id,
      customer_email,
      customer_name,
      customer_phone,
      items,
      subtotal,
      shipping_fee = 10.0, // Default shipping fee
      payment_method,
      payment_status = 'unpaid',
      shipping_status = 'pending',
      shipping_address,
      source = 'online_store',
      notes,
      // Ad tracking data for offline conversions
      ad_tracking,
      // Wallet redemption (2025: auto-apply full balance at checkout)
      use_wallet_credit = false,
      wallet_amount = 0,
      // User ID for linking customer to auth user (passed from checkout if logged in)
      user_id,
    } = body;

    // Validate merchant_id is a valid UUID
    if (!merchant_id || !isValidUuid(merchant_id)) {
      return NextResponse.json(
        { error: 'Invalid merchant ID' },
        { status: 400 }
      );
    }
    // Fetch merchant to verify it exists (include business_name, slug for email)
    const { data: merchant, error: merchantFetchError } = await supabase
      .from('merchants')
      .select(
        'id, rider_phone_number, business_name, slug, support_email, email_sender_name, email'
      )
      .eq('id', merchant_id)
      .single();

    if (merchantFetchError || !merchant) {
      logger.error({
        message: 'Failed to fetch merchant for order creation',
        error: merchantFetchError,
      });
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Validate required fields
    if (!customer_email || !customer_name || !items || subtotal === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Order must contain at least one item' },
        { status: 400 }
      );
    }

    // Calculate total
    const total = Number.parseFloat(subtotal) + Number.parseFloat(shipping_fee);

    // Create or get customer record
    let customer_id = null;
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id, user_id')
      .eq('merchant_id', merchant_id)
      .eq('email', customer_email)
      .single();

    if (existingCustomer) {
      customer_id = existingCustomer.id;
      // Link user_id if logged in and not already linked (2025: unified customer identity)
      if (user_id && !existingCustomer.user_id) {
        void supabase
          .from('customers')
          .update({ user_id })
          .eq('id', existingCustomer.id);
      }
    } else {
      // Create new customer
      const nameParts = customer_name.split(' ');
      const first_name = nameParts[0] || '';
      const last_name = nameParts.slice(1).join(' ') || '';

      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          merchant_id,
          email: customer_email,
          first_name,
          last_name,
          phone: customer_phone,
          // Link to auth user if logged in (2025: unified customer identity)
          ...(user_id && { user_id }),
        })
        .select('id')
        .single();

      if (customerError) {
        console.error('Error creating customer:', customerError);
        // Continue without customer_id if customer creation fails
      } else {
        customer_id = newCustomer.id;
      }
    }

    // Base order payload (items stored separately in order_items table)
    // Financial breakdown follows e-commerce best practices for auditing, refunds, and analytics
    const orderPayload: Record<string, unknown> = {
      merchant_id,
      customer_id,
      customer_email,
      customer_name,
      customer_phone,
      subtotal,
      shipping_fee,
      discount_amount: body.discount_amount || 0,
      tax_amount: body.tax_amount || 0,
      total,
      payment_method,
      payment_status,
      shipping_status,
      shipping_address,
      source,
      notes,
      // Store ad tracking data for offline conversion attribution
      // This is stored as JSONB and used when sending CAPI events after payment
      // Enhanced with server-captured IP/User Agent for better Event Match Quality
      ad_tracking: ad_tracking
        ? {
          ...ad_tracking,
          // Server-side captured data for better EMQ
          userIp: clientIp || ad_tracking.userIp,
          userAgent: clientUserAgent || ad_tracking.userAgent,
          // Server-detected privacy compliance (overrides client if more restrictive)
          limitedDataUse:
            geoPrivacy.shouldApplyLDU || ad_tracking.limitedDataUse,
          // Store geo info for analytics
          geoCountry: geoPrivacy.country,
          geoRegion: geoPrivacy.region,
        }
        : clientIp || clientUserAgent || geoPrivacy.shouldApplyLDU
          ? {
            userIp: clientIp,
            userAgent: clientUserAgent,
            limitedDataUse: geoPrivacy.shouldApplyLDU,
            geoCountry: geoPrivacy.country,
            geoRegion: geoPrivacy.region,
          }
          : null,
    };

    // Dynamically handle shipping based on request shipping_provider
    const shippingProvider = body.shipping_provider || 'GIGL';
    if (shippingProvider === 'GIGL') {
      const shipmentDetails = await handleGiglShipment(
        { items },
        { name: customer_name, phone: customer_phone },
        shipping_address
      );
      if (shipmentDetails) {
        orderPayload.shipping_provider = shipmentDetails.shipping_provider;
        orderPayload.tracking_number = shipmentDetails.tracking_number;
      }
    }

    // Handle Pay on Delivery (POD) Logic
    if (payment_method === 'pod') {
      orderPayload.payment_status = 'pending'; // Ensure it's pending for POD

      // Trigger Rider Notification (Placeholder)
      if (merchant?.rider_phone_number) {
        logger.info({
          message: 'Rider Notification Triggered (POD)',
          riderPhone: merchant.rider_phone_number,
          customerName: customer_name,
          customerAddress: shipping_address?.address,
          orderTotal: total,
        });
        // TODO: Integrate with WhatsApp API provider here
      } else {
        logger.warn({
          message: 'Rider Notification Skipped (No Phone Number)',
          merchantId: merchant_id,
        });
      }
    }

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderPayload)
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      return NextResponse.json(
        { error: 'Failed to create order', details: orderError.message },
        { status: 500 }
      );
    }

    // Insert order items into the new normalized table
    if (order) {
      const orderItems = items.map(
        (
          item: OrderItem & { has_assurance?: boolean; assurance_fee?: number }
        ) => ({
          order_id: order.id,
          product_id: item.product_id || item.productId || item.id, // Handle various potential input formats
          name: item.name || item.productName || 'Unknown Product',
          quantity: item.quantity || 1,
          price: item.price || 0,
          has_assurance: item.has_assurance || false,
          assurance_fee: item.assurance_fee || 0,
        })
      );

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Error creating order items:', itemsError);
        // Note: In a production environment, we should use a transaction or rollback the order creation.
      } else {
        // Update product stock atomically using RPC function
        // PERFORMANCE: Parallelize stock updates instead of sequential for...of loop
        const stockUpdatePromises = orderItems
          .filter((item) => item.product_id)
          .map(async (item) => {
            const { data: stockResult, error: stockError } = await supabase.rpc(
              'decrement_product_stock',
              {
                product_id_param: item.product_id,
                quantity_param: item.quantity,
              }
            );

            if (stockError) {
              console.error('Error updating stock:', stockError);
              return {
                success: false,
                productId: item.product_id,
                error: stockError,
              };
            }

            if (stockResult && stockResult.length > 0) {
              const result = stockResult[0];
              if (!result.success) {
                logger.warn({
                  message: 'Stock update failed for product',
                  productId: item.product_id,
                  reason: result.message,
                });
              }
              return { success: result.success, productId: item.product_id };
            }

            return { success: true, productId: item.product_id };
          });

        // Wait for all stock updates to complete in parallel
        await Promise.all(stockUpdatePromises);
      }

      // Create transaction record for POD orders (2025 best practice: single source of truth)
      if (payment_method === 'pod') {
        const serviceClient = createServiceClient();
        await serviceClient.from('transactions').insert({
          merchant_id: merchant.id,
          order_id: order.id,
          transaction_type: 'payment',
          amount: total,
          currency: 'NGN',
          status: 'pending', // POD is pending until delivery
          gateway: 'pod',
          gateway_reference: `POD-${order.id.slice(0, 8).toUpperCase()}`,
          platform_fee: 0,
          merchant_amount: total,
          description: `Pay on Delivery for order ${order.order_number || order.id}`,
          metadata: {
            customer_email: customer_email,
            customer_name: customer_name,
            payment_type: 'pay_on_delivery',
          },
        });
      }
    }

    // === WALLET REDEMPTION (2025 Best Practice: Auto-apply at checkout) ===
    // Process wallet credit redemption atomically after order creation
    let walletRedemptionResult: {
      success: boolean;
      amountRedeemed: number;
      newBalance: number;
      transactionId: string | null;
    } | null = null;

    if (use_wallet_credit && wallet_amount > 0 && customer_id) {
      try {
        // Call atomic wallet redemption function (handles idempotency via order_id)
        const { data: redemptionData, error: redemptionError } =
          await supabase.rpc('redeem_wallet_for_order', {
            p_customer_id: customer_id,
            p_merchant_id: merchant_id,
            p_order_id: order.id,
            p_amount: Math.min(wallet_amount, total), // Can't redeem more than order total
            p_order_reference: order.order_number || order.id,
          });

        if (redemptionError) {
          // Log but don't fail order - wallet redemption is optional
          logger.error({
            message: 'Wallet redemption failed',
            error: redemptionError,
            orderId: order.id,
            customerId: customer_id,
            requestedAmount: wallet_amount,
          });
        } else if (redemptionData?.[0]) {
          const result = redemptionData[0];
          if (result.success) {
            walletRedemptionResult = {
              success: true,
              amountRedeemed: Number(result.redeemed_amount),
              newBalance: Number(result.new_balance),
              transactionId: result.transaction_id,
            };

            logger.info({
              message: 'Wallet redemption successful',
              orderId: order.id,
              customerId: customer_id,
              amountRedeemed: result.redeemed_amount,
              newBalance: result.new_balance,
            });
          } else {
            logger.warn({
              message: 'Wallet redemption returned unsuccessful',
              orderId: order.id,
              customerId: customer_id,
              result,
            });
          }
        }
      } catch (walletError) {
        logger.error({
          message: 'Wallet redemption exception',
          error: walletError,
          orderId: order.id,
        });
      }
    }

    // Calculate amount due to payment gateway (total - wallet credit used)
    const walletAmountUsed = walletRedemptionResult?.amountRedeemed || 0;
    const amountDueToGateway = total - walletAmountUsed;

    // If wallet fully covers the order, mark as paid immediately (2025 best practice)
    if (walletAmountUsed > 0 && amountDueToGateway <= 0) {
      await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          payment_method: 'wallet',
        })
        .eq('id', order.id);

      // Create transaction record for wallet payment (2025 best practice: single source of truth)
      const serviceClient = createServiceClient();
      await serviceClient.from('transactions').insert({
        merchant_id: merchant.id,
        order_id: order.id,
        transaction_type: 'payment',
        amount: walletAmountUsed,
        currency: 'NGN',
        status: 'completed',
        gateway: 'wallet',
        gateway_reference: `WALLET-${order.id.slice(0, 8).toUpperCase()}`,
        platform_fee: 0,
        merchant_amount: walletAmountUsed,
        description: `Wallet payment for order ${order.order_number || order.id}`,
        metadata: {
          customer_email: customer_email,
          customer_name: customer_name,
          wallet_credit_used: walletAmountUsed,
        },
      });

      logger.info({
        message: 'Order fully paid with wallet credit',
        orderId: order.id,
        walletAmountUsed,
      });
    }

    // NOTE: Order confirmation email is NOT sent here at order creation.
    // It is sent ONLY after payment is confirmed via webhook handlers:
    // - /api/payments/webhook/route.ts (for Paystack/Korapay)
    // - /api/payments/juicyway/webhook/route.ts (for Juicyway)
    // This prevents sending confirmation emails for abandoned/unpaid orders.
    //
    // Exceptions (send immediately):
    // - POD (Pay on Delivery) or Invoice: no payment gateway redirect
    // - Wallet-paid orders: payment already confirmed via wallet redemption
    const isWalletFullyPaid = walletAmountUsed > 0 && amountDueToGateway <= 0;
    if (
      payment_method === 'pod' ||
      payment_method === 'invoice' ||
      isWalletFullyPaid
    ) {
      try {
        if (merchant.business_name && merchant.slug) {
          const rootDomain =
            process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
          const merchantUrl = `https://${merchant.slug}.${rootDomain}`;

          // Format items for email template
          const emailItems = items.map((item: OrderItem) => ({
            name: item.name || item.productName || 'Product',
            quantity: item.quantity || 1,
            price: item.price || 0,
          }));

          // Generate email content
          const emailData = {
            orderNumber:
              order.order_number || order.id.slice(0, 8).toUpperCase(),
            customerName: customer_name,
            items: emailItems,
            subtotal: Number.parseFloat(subtotal),
            shippingFee: Number.parseFloat(shipping_fee),
            total: Number.parseFloat(total.toString()),
            shippingAddress: {
              address: shipping_address?.address || '',
              city: shipping_address?.city || '',
              state: shipping_address?.state || '',
              phone: customer_phone || '',
            },
            merchantName: merchant.business_name,
            merchantUrl,
          };

          const htmlContent = generateOrderConfirmationEmail(emailData);
          const textContent = generateOrderConfirmationText(emailData);

          // Send email asynchronously (don't wait for it)
          // Use merchant's support_email as reply-to (so customer replies go to merchant)
          // Use merchant's email_sender_name for branding (e.g., "Ogabassey Orders" instead of "Baci Orders")
          const replyToEmail =
            merchant.support_email ||
            merchant.email ||
            `support@${merchant.slug}.${rootDomain}`;
          const senderName = merchant.email_sender_name
            ? `${merchant.email_sender_name} Orders`
            : merchant.business_name
              ? `${merchant.business_name} Orders`
              : undefined;

          sendEmail({
            to: customer_email,
            toName: customer_name,
            subject: `Order Confirmation - #${emailData.orderNumber}`,
            htmlContent,
            textContent,
            replyTo: replyToEmail,
            emailType: 'orders',
            fromName: senderName,
          }).catch((emailError) => {
            logger.error({
              message: 'Failed to send order confirmation email',
              error: emailError,
            });
          });

          logger.info({
            message: 'Order confirmation email queued (POD/Invoice)',
            orderId: order.id,
            email: customer_email,
            paymentMethod: payment_method,
          });
        }
      } catch (emailError) {
        // Don't fail the order creation if email fails
        logger.error({
          message: 'Error preparing order confirmation email',
          error: emailError,
        });
      }
    }

    // Return order with wallet info for checkout UI
    return NextResponse.json(
      {
        order,
        // Wallet redemption details for UI display
        wallet: walletRedemptionResult
          ? {
            amountUsed: walletRedemptionResult.amountRedeemed,
            newBalance: walletRedemptionResult.newBalance,
            transactionId: walletRedemptionResult.transactionId,
          }
          : null,
        // Amount still due to payment gateway (for payment initialization)
        amountDueToGateway,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Unexpected error in POST /api/orders:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
