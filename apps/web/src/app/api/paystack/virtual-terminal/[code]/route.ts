/**
 * Virtual Terminal Detail API Routes
 *
 * Fetch, update, and deactivate a specific Virtual Terminal.
 */

import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  fetchVirtualTerminal,
  updateVirtualTerminal,
  deactivateVirtualTerminal,
} from '@/lib/paystack';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * GET /api/paystack/virtual-terminal/[code]
 * Fetch a specific Virtual Terminal
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { code } = await params;
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify merchant owns this terminal
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id, virtual_terminal_code')
      .eq('user_id', user.id)
      .single();

    if (!merchant || merchant.virtual_terminal_code !== code) {
      return NextResponse.json(
        { error: 'Terminal not found or not authorized' },
        { status: 404 }
      );
    }

    const result = await fetchVirtualTerminal(code);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      terminal: result.data,
      paymentLink: `https://paystack.com/vt/${result.data.code}`,
    });
  } catch (error) {
    console.error('Virtual Terminal fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Virtual Terminal' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/paystack/virtual-terminal/[code]
 * Update a Virtual Terminal's name
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { code } = await params;
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify merchant owns this terminal
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id, virtual_terminal_code')
      .eq('user_id', user.id)
      .single();

    if (!merchant || merchant.virtual_terminal_code !== code) {
      return NextResponse.json(
        { error: 'Terminal not found or not authorized' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name } = z.object({ name: z.string().min(2) }).parse(body);

    const result = await updateVirtualTerminal(code, name);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      terminal: result.data,
    });
  } catch (error) {
    console.error('Virtual Terminal update error:', error);
    return NextResponse.json(
      { error: 'Failed to update Virtual Terminal' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/paystack/virtual-terminal/[code]
 * Deactivate a Virtual Terminal
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { code } = await params;
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify merchant owns this terminal
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id, virtual_terminal_code')
      .eq('user_id', user.id)
      .single();

    if (!merchant || merchant.virtual_terminal_code !== code) {
      return NextResponse.json(
        { error: 'Terminal not found or not authorized' },
        { status: 404 }
      );
    }

    const result = await deactivateVirtualTerminal(code);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Clear terminal code from merchant record
    await supabase
      .from('merchants')
      .update({ virtual_terminal_code: null })
      .eq('id', merchant.id);

    return NextResponse.json({
      success: true,
      message: 'Virtual Terminal deactivated',
    });
  } catch (error) {
    console.error('Virtual Terminal deactivation error:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate Virtual Terminal' },
      { status: 500 }
    );
  }
}
