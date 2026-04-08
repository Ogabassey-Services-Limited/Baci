import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const wishlistCreateSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  merchantId: z.string().uuid('Invalid merchant ID'),
  sessionToken: z.string().min(16).optional(),
});

/**
 * Hash a session token for privacy (don't store raw tokens)
 */
function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Validate UUID format
 */
function isValidUUID(str: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * GET /api/wishlist?session=xxx OR authenticated user
 * Get wish list items for authenticated user or guest session
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionToken = searchParams.get('session');

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Check for authenticated user first
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let customerIdentifier: string;

    if (user?.email) {
      // Authenticated user - use their email
      customerIdentifier = user.email;
    } else if (sessionToken && sessionToken.length >= 16) {
      // Guest user - use hashed session token as identifier
      customerIdentifier = `guest:${hashSessionToken(sessionToken)}`;
    } else {
      return NextResponse.json(
        {
          error:
            'Authentication required. Please login or provide a session token.',
        },
        { status: 401 }
      );
    }

    // Get wish list items with product details including joined category
    const { data: wishListItems, error } = await supabase
      .from('wish_list_items')
      .select(`
        id,
        created_at,
        product_id,
        products (
          id,
          name,
          slug,
          description,
          price,
          images,
          stock_quantity,
          status,
          category,
          category_id,
          categories:category_id(id, name, slug)
        )
      `)
      .eq('customer_email', customerIdentifier)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ items: wishListItems || [] });
  } catch (error) {
    console.error('Error fetching wish list:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/wishlist
 * Add item to wish list (authenticated user or guest session)
 */
export async function POST(request: NextRequest) {
  try {
    // CSRF: handled by Origin-based middleware in proxy.ts (guest storefront route)
    const parsed = wishlistCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Product ID and Merchant ID are required' },
        { status: 400 }
      );
    }
    const { productId, merchantId, sessionToken } = parsed.data;

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Check for authenticated user first
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let customerIdentifier: string;

    if (user?.email) {
      // Authenticated user - use their email
      customerIdentifier = user.email;
    } else if (sessionToken && sessionToken.length >= 16) {
      // Guest user - use hashed session token as identifier
      customerIdentifier = `guest:${hashSessionToken(sessionToken)}`;
    } else {
      return NextResponse.json(
        {
          error:
            'Authentication required. Please login or provide a session token.',
        },
        { status: 401 }
      );
    }

    // Add to wish list
    const { data: wishListItem, error } = await supabase
      .from('wish_list_items')
      .insert({
        customer_email: customerIdentifier,
        product_id: productId,
        merchant_id: merchantId,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Item already in wish list' },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ item: wishListItem }, { status: 201 });
  } catch (error) {
    console.error('Error adding to wish list:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/wishlist?id=uuid&session=xxx
 * Remove item from wish list (with ownership verification)
 */
export async function DELETE(request: NextRequest) {
  try {
    // CSRF: handled by Origin-based middleware in proxy.ts (guest storefront route)
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('id');
    const sessionToken = searchParams.get('session');

    if (!itemId) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      );
    }

    if (!isValidUUID(itemId)) {
      return NextResponse.json(
        { error: 'Invalid item ID format' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Check for authenticated user first
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let customerIdentifier: string;

    if (user?.email) {
      customerIdentifier = user.email;
    } else if (sessionToken && sessionToken.length >= 16) {
      customerIdentifier = `guest:${hashSessionToken(sessionToken)}`;
    } else {
      return NextResponse.json(
        {
          error:
            'Authentication required. Please login or provide a session token.',
        },
        { status: 401 }
      );
    }

    // Verify ownership before deletion
    const { data: item, error: fetchError } = await supabase
      .from('wish_list_items')
      .select('id, customer_email')
      .eq('id', itemId)
      .single();

    if (fetchError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Check ownership
    if (item.customer_email !== customerIdentifier) {
      return NextResponse.json(
        { error: 'Not authorized to delete this item' },
        { status: 403 }
      );
    }

    // Delete the item
    const { error } = await supabase
      .from('wish_list_items')
      .delete()
      .eq('id', itemId)
      .eq('customer_email', customerIdentifier);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing from wish list:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
