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
    } = body;

    // Validate merchant_id is a valid UUID
    if (!merchant_id || !isValidUuid(merchant_id)) {
      return NextResponse.json(
        { error: 'Invalid merchant ID' },
        { status: 400 }
      );
    }
    // Fetch merchant to verify it exists
    const { data: merchant, error: merchantFetchError } = await supabase
      .from('merchants')
      .select('id, rider_phone_number')
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
      .select('id')
      .eq('merchant_id', merchant_id)
      .eq('email', customer_email)
      .single();

    if (existingCustomer) {
      customer_id = existingCustomer.id;
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
        for (const item of orderItems) {
          if (item.product_id) {
            // Use atomic stock decrement function to prevent race conditions
            const { data: stockResult, error: stockError } = await supabase.rpc(
              'decrement_product_stock',
              {
                product_id_param: item.product_id,
                quantity_param: item.quantity,
              }
            );

            if (stockError) {
              console.error('Error updating stock:', stockError);
              // Continue processing other items even if one fails
            } else if (stockResult && stockResult.length > 0) {
              const result = stockResult[0];
              if (!result.success) {
                // Use structured logging to prevent log injection attacks
                // User-provided values are passed as separate fields, not interpolated into the message
                logger.warn({
                  message: 'Stock update failed for product',
                  productId: item.product_id,
                  reason: result.message,
                });
                // In production, you might want to handle insufficient stock differently
                // For now, we log and continue
              }
            }
          }
        }
      }
    }

    // Send order confirmation email (non-blocking)
    try {
      // Fetch merchant details for email
      const { data: merchantDetails } = await supabase
        .from('merchants')
        .select('business_name, slug')
        .eq('id', merchant_id)
        .single();

      if (merchantDetails) {
        const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
        const merchantUrl = `https://${merchantDetails.slug}.${rootDomain}`;

        // Format items for email template
        const emailItems = items.map((item: OrderItem) => ({
          name: item.name || item.productName || 'Product',
          quantity: item.quantity || 1,
          price: item.price || 0,
        }));

        // Generate email content
        const emailData = {
          orderNumber: order.order_number || order.id.slice(0, 8).toUpperCase(),
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
          merchantName: merchantDetails.business_name,
          merchantUrl,
        };

        const htmlContent = generateOrderConfirmationEmail(emailData);
        const textContent = generateOrderConfirmationText(emailData);

        // Send email asynchronously (don't wait for it)
        sendEmail({
          to: customer_email,
          toName: customer_name,
          subject: `Order Confirmation - #${emailData.orderNumber}`,
          htmlContent,
          textContent,
          replyTo: `support@${merchantDetails.slug}.${rootDomain}`,
          emailType: 'orders',
        }).catch((emailError) => {
          logger.error({
            message: 'Failed to send order confirmation email',
            error: emailError,
          });
        });

        logger.info({
          message: 'Order confirmation email queued',
          orderId: order.id,
          email: customer_email,
        });
      }
    } catch (emailError) {
      // Don't fail the order creation if email fails
      logger.error({
        message: 'Error preparing order confirmation email',
        error: emailError,
      });
    }

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in POST /api/orders:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
