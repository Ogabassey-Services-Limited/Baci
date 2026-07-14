/**
 * Virtual Terminal API Routes
 *
 * Manages Paystack Virtual Terminals for WhatsApp payment notifications.
 * Supports multiple terminals per merchant for staff/branch tracking.
 */

import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import z from 'zod';
import { authenticateApiRequest, hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { logger } from '@/lib/logger';
import { createVirtualTerminal } from '@/lib/paystack';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// =============================================================================
// Validation Schemas
// =============================================================================

const CreateTerminalSchema = z.object({
  name: z.string().min(2, 'Account name must be at least 2 characters'),
  staffId: z.uuid().optional(), // Optional staff assignment
  branchId: z.uuid().optional(), // Optional branch assignment
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
    // CSRF protection
    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request);
    if (!csrfValid) {
      return (
        csrfResponse ??
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

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'integrations', 'manage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;
    const businessName = merchantContext.businessName;

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
      name || `${businessName} Account`,
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
    const adminSupabase = createAdminClient();
    const { data: savedTerminal, error: insertError } = await adminSupabase
      .from('virtual_terminals')
      .insert({
        merchant_id: merchantId,
        staff_id: staffId || null,
        branch_id: branchId || null,
        code: result.data.code,
        name: name || `${businessName} Account`,
        account_number: nubanMethod?.account_number || null,
        account_name: nubanMethod?.account_name || null,
        bank: nubanMethod?.bank || null,
        payment_link: `https://paystack.com/vt/${result.data.code}`,
        active: true,
      })
      .select('id')
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

    // Also update legacy column for backwards compatibility.
    const { data: existingLegacy, error: existingLegacyError } = await supabase
      .from('merchants')
      .select('virtual_terminal_code')
      .eq('id', merchantId)
      .single();

    let legacySyncWarning:
      | 'legacy_fetch_failed'
      | 'legacy_update_failed'
      | null = null;
    if (existingLegacyError) {
      logger.error({
        message: 'Failed to fetch merchant legacy virtual terminal code',
        error: existingLegacyError,
        merchantId,
        paystackCode: result.data.code,
      });
      legacySyncWarning = 'legacy_fetch_failed';
    } else if (!existingLegacy?.virtual_terminal_code) {
      const { data: updatedLegacy, error: updateLegacyError } = await supabase
        .from('merchants')
        .update({ virtual_terminal_code: result.data.code })
        .eq('id', merchantId)
        .select('id')
        .maybeSingle();

      if (updateLegacyError || !updatedLegacy?.id) {
        logger.error({
          message: 'Failed to update merchant legacy virtual terminal code',
          error: updateLegacyError ?? 'merchant_not_updated',
          merchantId,
          paystackCode: result.data.code,
        });
        legacySyncWarning = 'legacy_update_failed';
      }
    }

    return NextResponse.json({
      ...(legacySyncWarning ? { legacySyncWarning } : {}),
      success: true,
      terminal: {
        id: savedTerminal?.id,
        code: result.data.code,
        name: name || `${businessName} Terminal`,
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
export async function GET(request: NextRequest) {
  try {
    // Support both Bearer token (mobile) and cookie-based (web) auth
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }
    const { user } = auth;
    const supabase = auth.supabase;

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'integrations', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    const { data: terminals, error: terminalsError } = await supabase
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
          full_name:name
        )
      `)
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false });

    if (terminalsError) {
      logger.error({
        message: 'Failed to list virtual terminals',
        error: terminalsError,
        merchantId,
      });
      return NextResponse.json(
        { error: 'Failed to list Virtual Terminals' },
        { status: 500 }
      );
    }

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
