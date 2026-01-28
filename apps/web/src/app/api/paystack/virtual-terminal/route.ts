/**
 * Virtual Terminal API Routes
 *
 * Manages Paystack Virtual Terminals for WhatsApp payment notifications.
 * Supports multiple terminals per merchant for staff/branch tracking.
 */

import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import z from 'zod';
import { createVirtualTerminal } from '@/lib/paystack';
import { createClient } from '@/lib/supabase/server';

// =============================================================================
// Validation Schemas
// =============================================================================

const CreateTerminalSchema = z.object({
  name: z.string().min(2, 'Account name must be at least 2 characters'),
  staffId: z.string().uuid().optional(), // Optional staff assignment
  branchId: z.string().uuid().optional(), // Optional branch assignment
  destinations: z
    .array(
      z.object({
        target: z
          .string()
          .regex(
            /^\+\d{10,15}$/,
            'Invalid phone number (E.164 format required)'
          ),
        name: z.string().min(1, 'Destination name is required'),
      })
    )
    .max(5, 'Maximum 5 WhatsApp destinations allowed')
    .optional()
    .default([]),
});

// =============================================================================
// Route Handlers
// =============================================================================

/**
 * POST /api/paystack/virtual-terminal
 * Create a new Virtual Terminal for the merchant
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id, business_name')
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parseResult = CreateTerminalSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, staffId, branchId, destinations } = parseResult.data;

    // Create terminal via Paystack API
    const result = await createVirtualTerminal(
      name || `${merchant.business_name} Account`,
      destinations
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Extract NUBAN bank account details (for Nigeria)
    const nubanMethod = result.data.paymentMethods?.find(
      (m) => m.type === 'dedicated_nuban'
    );

    // Save terminal to virtual_terminals table
    const { data: savedTerminal, error: insertError } = await supabase
      .from('virtual_terminals')
      .insert({
        merchant_id: merchant.id,
        staff_id: staffId || null,
        branch_id: branchId || null,
        code: result.data.code,
        name: name || `${merchant.business_name} Account`,
        account_number: nubanMethod?.account_number || null,
        account_name: nubanMethod?.account_name || null,
        bank: nubanMethod?.bank || null,
        payment_link: `https://paystack.com/vt/${result.data.code}`,
        active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to save terminal to DB:', insertError);
      // Terminal was created in Paystack but not saved locally - this is critical
      return NextResponse.json(
        {
          success: false,
          error:
            'Terminal created in Paystack but failed to save locally. Please contact support.',
          paystackCode: result.data.code,
        },
        { status: 500 }
      );
    }

    // Also update legacy column for backwards compatibility
    const { data: existingLegacy } = await supabase
      .from('merchants')
      .select('virtual_terminal_code')
      .eq('id', merchant.id)
      .single();

    if (!existingLegacy?.virtual_terminal_code) {
      await supabase
        .from('merchants')
        .update({ virtual_terminal_code: result.data.code })
        .eq('id', merchant.id);
    }

    return NextResponse.json({
      success: true,
      terminal: {
        id: savedTerminal?.id,
        code: result.data.code,
        name: name || `${merchant.business_name} Terminal`,
        accountNumber: nubanMethod?.account_number,
        accountName: nubanMethod?.account_name,
        bank: nubanMethod?.bank,
        paymentLink: `https://paystack.com/vt/${result.data.code}`,
        staffId: staffId || null,
        active: true,
      },
    });
  } catch (error) {
    console.error('Virtual Terminal creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create Virtual Terminal' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/paystack/virtual-terminal
 * List all Virtual Terminals for the merchant from database
 */
export async function GET(_request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      // Check if user is staff
      const { data: staffMember } = await supabase
        .from('staff_members')
        .select('merchant_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (!staffMember) {
        return NextResponse.json(
          { error: 'Merchant not found' },
          { status: 404 }
        );
      }

      // Staff member - get terminals for their merchant
      const { data: terminals } = await supabase
        .from('virtual_terminals')
        .select(`
          id,
          code,
          name,
          account_number,
          account_name,
          bank,
          payment_link,
          active,
          created_at,
          staff_id,
          staff_members (
            id,
            full_name
          )
        `)
        .eq('merchant_id', staffMember.merchant_id)
        .order('created_at', { ascending: false });

      return NextResponse.json({
        success: true,
        terminals: terminals || [],
      });
    }

    // Merchant owner - get all terminals
    const { data: terminals } = await supabase
      .from('virtual_terminals')
      .select(`
        id,
        code,
        name,
        account_number,
        account_name,
        bank,
        payment_link,
        active,
        created_at,
        staff_id,
        staff_members (
          id,
          full_name
        )
      `)
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      success: true,
      terminals: terminals || [],
    });
  } catch (error) {
    console.error('Virtual Terminal list error:', error);
    return NextResponse.json(
      { error: 'Failed to list Virtual Terminals' },
      { status: 500 }
    );
  }
}
