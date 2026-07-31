import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { logger } from '@/lib/logger';
import { createVirtualTerminal } from '@/lib/paystack';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  createVirtualTerminalSchema,
  virtualTerminalListQuerySchema,
} from '@/schemas/paystack-virtual-terminal';
import { validateTerminalAssignments } from './validate-terminal-assignments';

// =============================================================================
// Route Handlers
// =============================================================================

/**
 * POST /api/paystack/virtual-terminal
 * Create a new Virtual Terminal for the merchant
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }
    const { supabase, user } = auth;

    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const parseResult = createVirtualTerminalSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id, {
      requestedMerchantId: parseResult.data.merchantId,
    });
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
    const { name, staffId, branchId, destinations } = parseResult.data;

    const adminSupabase = createAdminClient();
    const assignmentValidation = await validateTerminalAssignments(
      adminSupabase,
      merchantId,
      { branchId, staffId }
    );
    if (assignmentValidation.error) {
      return NextResponse.json(
        { error: assignmentValidation.error },
        { status: assignmentValidation.status }
      );
    }

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
    // `virtual_terminal_code` is revoked from the authenticated role, so the
    // read goes via the bounded SECURITY DEFINER RPC (re-checks access inside
    // the definer); the UPDATE below only SETs it by id, still table-granted.
    const { data: existingLegacyCode, error: existingLegacyError } =
      await supabase.rpc('get_merchant_virtual_terminal_code', {
        p_merchant_id: merchantId,
      });
    const existingLegacy = existingLegacyError
      ? null
      : { virtual_terminal_code: existingLegacyCode };

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

    const parsedQuery = virtualTerminalListQuerySchema.safeParse({
      merchantId: request.nextUrl.searchParams.get('merchantId') ?? undefined,
    });
    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: 'Invalid merchant context' },
        { status: 400 }
      );
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id, {
      requestedMerchantId: parsedQuery.data.merchantId,
    });
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
