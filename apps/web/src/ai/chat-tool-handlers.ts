/**
 * Chat Tool Handlers
 *
 * Implements the actual logic for each AI tool.
 * These handlers are called when the AI invokes a tool.
 */

import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type {
  AddToCartParams,
  CheckPaymentStatusParams,
  CreateVirtualAccountParams,
  GetProductDetailsParams,
  GetRecommendationsParams,
  SearchProductsParams,
} from './chat-tools';

// Ogabassey merchant ID (hardcoded for now, can be made dynamic)
const OGABASSEY_MERCHANT_ID = '3bc72679-c0f7-4db4-9054-6a4a4a95a498';

// ============================================
// SEARCH PRODUCTS
// ============================================

interface ProductSearchResult {
  id: string;
  name: string;
  price: number;
  description: string | null;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  stock: number | null;
  status: string;
}

export async function handleSearchProducts(
  params: SearchProductsParams
): Promise<{ products: ProductSearchResult[]; total: number }> {
  const supabase = createAdminClient();

  let query = supabase
    .from('products')
    .select(
      'id, name, price, description, brand, category, images, stock, status'
    )
    .eq('merchant_id', OGABASSEY_MERCHANT_ID)
    .eq('status', 'active')
    .order('price', { ascending: false })
    .limit(10);

  // Apply search filter
  if (params.query) {
    query = query.or(
      `name.ilike.%${params.query}%,description.ilike.%${params.query}%`
    );
  }

  // Apply category filter
  if (params.category) {
    query = query.ilike('category', `%${params.category}%`);
  }

  // Apply price filters
  if (params.maxPrice) {
    query = query.lte('price', params.maxPrice);
  }
  if (params.minPrice) {
    query = query.gte('price', params.minPrice);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[Chat Tools] Search error:', error);
    return { products: [], total: 0 };
  }

  const products = (data || []).map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    description: p.description,
    brand: p.brand,
    category: p.category,
    image_url:
      Array.isArray(p.images) && p.images[0]?.url ? p.images[0].url : null,
    stock: p.stock,
    status: p.status,
  }));

  return { products, total: count || products.length };
}

// ============================================
// GET PRODUCT DETAILS
// ============================================

export async function handleGetProductDetails(
  params: GetProductDetailsParams
): Promise<ProductSearchResult | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('products')
    .select(
      'id, name, price, description, brand, category, images, stock, status'
    )
    .eq('id', params.productId)
    .eq('merchant_id', OGABASSEY_MERCHANT_ID)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    price: data.price,
    description: data.description,
    brand: data.brand,
    category: data.category,
    image_url:
      Array.isArray(data.images) && data.images[0]?.url
        ? data.images[0].url
        : null,
    stock: data.stock,
    status: data.status,
  };
}

// ============================================
// CREATE VIRTUAL ACCOUNT
// ============================================

interface VirtualAccountResult {
  success: boolean;
  orderId?: string;
  accountNumber?: string;
  bankName?: string;
  accountName?: string;
  amount?: number;
  expiresAt?: string;
  error?: string;
}

export async function handleCreateVirtualAccount(
  params: CreateVirtualAccountParams,
  sessionId: string
): Promise<VirtualAccountResult> {
  const supabase = createAdminClient();

  try {
    // 1. Create the chat order first
    const subtotal = params.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const { data: order, error: orderError } = await supabase
      .from('chat_orders')
      .insert({
        merchant_id: OGABASSEY_MERCHANT_ID,
        session_id: sessionId,
        customer_email: params.customerEmail,
        customer_name: params.customerName,
        customer_phone: params.customerPhone || null,
        items: params.items,
        subtotal: subtotal,
        status: 'pending_payment',
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error('[Chat Tools] Order creation error:', orderError);
      return { success: false, error: 'Failed to create order' };
    }

    // 2. Generate virtual account via Kuda (simplified for now)
    // In production, this would call the Kuda API
    // For now, we'll create a simulated response
    const trackingRef = `CHAT-${order.id.slice(0, 8).toUpperCase()}`;

    // TODO: Replace with actual Kuda API call
    // const kudaResponse = await kudaRequest(KudaServiceType.ADMIN_CREATE_VIRTUAL_ACCOUNT, {...});

    // Simulated virtual account (replace with real Kuda integration)
    const virtualAccount = {
      accountNumber: '999' + Math.random().toString().slice(2, 9),
      bankName: 'Kuda Bank',
      accountName: `OGABASSEY/${params.customerName.toUpperCase()}`,
    };

    // 3. Update order with virtual account details
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await supabase
      .from('chat_orders')
      .update({
        virtual_account_number: virtualAccount.accountNumber,
        virtual_account_bank: virtualAccount.bankName,
        payment_reference: trackingRef,
      })
      .eq('id', order.id);

    return {
      success: true,
      orderId: order.id,
      accountNumber: virtualAccount.accountNumber,
      bankName: virtualAccount.bankName,
      accountName: virtualAccount.accountName,
      amount: params.amount,
      expiresAt: expiresAt.toISOString(),
    };
  } catch (err) {
    console.error('[Chat Tools] Virtual account error:', err);
    return { success: false, error: 'Failed to generate payment account' };
  }
}

// ============================================
// CHECK PAYMENT STATUS
// ============================================

interface PaymentStatusResult {
  status: 'pending' | 'paid' | 'expired' | 'not_found';
  orderId?: string;
  paidAt?: string;
  amount?: number;
  accountNumber?: string;
  bankName?: string;
}

export async function handleCheckPaymentStatus(
  params: CheckPaymentStatusParams
): Promise<PaymentStatusResult> {
  const supabase = createAdminClient();

  let order: {
    id: string;
    status: string;
    paid_at: string | null;
    created_at: string;
    subtotal: number;
    virtual_account_number: string | null;
    virtual_account_bank: string | null;
    metadata: Record<string, unknown> | null;
  } | null = null;

  // Try to find order by orderId first, then by email
  if (params.orderId) {
    const { data, error } = await supabase
      .from('chat_orders')
      .select(
        'id, status, paid_at, created_at, subtotal, virtual_account_number, virtual_account_bank, metadata'
      )
      .eq('id', params.orderId)
      .single();

    if (!error && data) {
      order = data;
    }
  }

  // If no orderId or not found, try by email (most recent)
  if (!order && params.customerEmail) {
    const { data, error } = await supabase
      .from('chat_orders')
      .select(
        'id, status, paid_at, created_at, subtotal, virtual_account_number, virtual_account_bank, metadata'
      )
      .eq('customer_email', params.customerEmail)
      .eq('merchant_id', '3bc72679-c0f7-4db4-9054-6a4a4a95a498') // Ogabassey merchant
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!error && data) {
      order = data;
    }
  }

  if (!order) {
    return { status: 'not_found' };
  }

  const metadata = order.metadata as Record<string, string> | null;
  const accountNumber =
    order.virtual_account_number || metadata?.account_number;
  const bankName = order.virtual_account_bank || metadata?.bank_name;

  if (order.status === 'paid') {
    return {
      status: 'paid',
      orderId: order.id,
      paidAt: order.paid_at || undefined,
      amount: order.subtotal,
    };
  }

  // Check if expired (30 min from creation)
  const createdAt = new Date(order.created_at);
  const expiresAt = new Date(createdAt.getTime() + 30 * 60 * 1000);

  if (new Date() > expiresAt) {
    return { status: 'expired', orderId: order.id };
  }

  return {
    status: 'pending',
    orderId: order.id,
    amount: order.subtotal,
    accountNumber: accountNumber || undefined,
    bankName: bankName || undefined,
  };
}

// ============================================
// GET RECOMMENDATIONS
// ============================================

export async function handleGetRecommendations(
  params: GetRecommendationsParams
): Promise<ProductSearchResult[]> {
  const supabase = createAdminClient();

  // First get the source product
  const { data: sourceProduct } = await supabase
    .from('products')
    .select('id, name, price, category, brand')
    .eq('id', params.productId)
    .single();

  if (!sourceProduct) {
    return [];
  }

  let query = supabase
    .from('products')
    .select(
      'id, name, price, description, brand, category, images, stock, status'
    )
    .eq('merchant_id', OGABASSEY_MERCHANT_ID)
    .eq('status', 'active')
    .neq('id', params.productId)
    .limit(3);

  if (params.type === 'upsell') {
    // Same category, higher price (10-50% more)
    query = query
      .eq('category', sourceProduct.category)
      .gt('price', sourceProduct.price * 1.1)
      .lt('price', sourceProduct.price * 1.5)
      .order('price', { ascending: true });
  } else if (params.type === 'cross_sell') {
    // Complementary categories
    const complementaryCategories = getComplementaryCategories(
      sourceProduct.category
    );
    query = query
      .in('category', complementaryCategories)
      .order('price', { ascending: false });
  } else {
    // Accessories - same brand, lower price
    query = query
      .eq('brand', sourceProduct.brand)
      .lt('price', sourceProduct.price * 0.3)
      .order('price', { ascending: false });
  }

  const { data } = await query;

  return (data || []).map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    description: p.description,
    brand: p.brand,
    category: p.category,
    image_url:
      Array.isArray(p.images) && p.images[0]?.url ? p.images[0].url : null,
    stock: p.stock,
    status: p.status,
  }));
}

// Helper: Get complementary categories
function getComplementaryCategories(category: string | null): string[] {
  const categoryPairs: Record<string, string[]> = {
    Smartphones: ['Accessories', 'Tablets', 'Wearables'],
    Laptops: ['Accessories', 'Monitors', 'Keyboards'],
    Gaming: ['Accessories', 'Monitors', 'Headphones'],
    Tablets: ['Accessories', 'Keyboards', 'Styluses'],
    Audio: ['Accessories', 'Smartphones', 'Wearables'],
  };

  return categoryPairs[category || ''] || ['Accessories'];
}

// ============================================
// ADD TO CART (Returns product for frontend)
// ============================================

export async function handleAddToCart(
  params: AddToCartParams
): Promise<ProductSearchResult | null> {
  // Just return the product details - actual cart management happens on frontend
  return handleGetProductDetails({ productId: params.productId });
}
