import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { checkCsrfProtection } from '@/lib/csrf';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';
import {
  formatZodErrors,
  reorderSuggestionActionSchema,
} from '@/schemas/inventory';

/**
 * Reorder Suggestions API
 *
 * GET - Get reorder suggestions
 * POST - Accept/reject a suggestion
 */

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const merchantId = merchantContext.merchantId;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    // Sentinel: Replaced select('*') with explicit columns
    const { data: suggestions, error } = await supabase
      .from('reorder_suggestions')
      .select(`
        id,
        merchant_id,
        product_id,
        suggested_quantity,
        status,
        created_at,
        accepted_at,
        ordered_quantity,
        products (
          id,
          name,
          image,
          stock,
          cost_price,
          price
        )
      `)
      .eq('merchant_id', merchantId)
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching suggestions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch suggestions' },
        { status: 500 }
      );
    }

    // Calculate total investment needed
    const totalInvestment = (suggestions || []).reduce((sum, s) => {
      const product = s.products as { cost_price?: number } | null;
      const costPrice = product?.cost_price || 0;
      return sum + s.suggested_quantity * costPrice;
    }, 0);

    return NextResponse.json({
      suggestions,
      stats: {
        totalSuggestions: suggestions?.length || 0,
        totalInvestment,
        totalUnits: (suggestions || []).reduce(
          (sum, s) => sum + s.suggested_quantity,
          0
        ),
      },
    });
  } catch (error) {
    console.error('Reorder suggestions GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Sentinel: Added CSRF protection (inside try/catch with fallback)
    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const merchantId = merchantContext.merchantId;

    // Parse JSON body with error handling for malformed payloads
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Malformed JSON in request body' },
        { status: 400 }
      );
    }

    // Sentinel: Added Zod validation
    const parseResult = reorderSuggestionActionSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatZodErrors(parseResult.error),
        },
        { status: 400 }
      );
    }

    const { suggestionId, action, orderedQuantity } = parseResult.data;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (action === 'accept') {
      updates.status = 'accepted';
      updates.accepted_at = new Date().toISOString();
    } else if (action === 'reject') {
      updates.status = 'rejected';
    } else if (action === 'ordered') {
      updates.status = 'ordered';
      if (orderedQuantity !== undefined) {
        updates.ordered_quantity = orderedQuantity;
      }
    }

    const { error } = await supabase
      .from('reorder_suggestions')
      .update(updates)
      .eq('id', suggestionId)
      .eq('merchant_id', merchantId);

    if (error) {
      console.error('Error updating suggestion:', error);
      return NextResponse.json(
        { error: 'Failed to update suggestion' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reorder suggestion POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
