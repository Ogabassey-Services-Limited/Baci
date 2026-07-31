/**
 * Virtual Terminal Detail API Routes
 *
 * Fetch, update, and deactivate a specific Virtual Terminal.
 */

import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import z from 'zod';
import { hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { logger } from '@/lib/logger';
import {
  deactivateVirtualTerminal,
  fetchVirtualTerminal,
  updateVirtualTerminal,
} from '@/lib/paystack';
import { createClient } from '@/lib/supabase/server';
import {
  clearLegacyTerminalCode,
  syncTerminalRecord,
  verifyTerminalOwnership,
} from './virtual-terminal-local-sync';

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * GET /api/paystack/virtual-terminal/[code]
 * Fetch a specific Virtual Terminal
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
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

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Terminal not found or not authorized' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'integrations', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    const ownershipError = await verifyTerminalOwnership(
      supabase,
      merchantId,
      code
    );
    if (ownershipError) return ownershipError;

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
    logger.error({ message: 'Virtual Terminal fetch error', error });
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

    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Terminal not found or not authorized' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'integrations', 'manage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    const ownershipError = await verifyTerminalOwnership(
      supabase,
      merchantId,
      code
    );
    if (ownershipError) return ownershipError;

    const body = await request.json();
    const parseResult = z.object({ name: z.string().min(2) }).safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name } = parseResult.data;
    const result = await updateVirtualTerminal(code, name);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const nubanMethod = result.data.paymentMethods?.find(
      (method) => method.type === 'dedicated_nuban'
    );
    const syncError = await syncTerminalRecord(merchantId, code, {
      accountName: nubanMethod?.account_name,
      accountNumber: nubanMethod?.account_number,
      bank: nubanMethod?.bank,
      name,
    });
    if (syncError) return syncError;

    return NextResponse.json({
      success: true,
      terminal: result.data,
    });
  } catch (error) {
    logger.error({ message: 'Virtual Terminal update error', error });
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
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
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

    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(_request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Terminal not found or not authorized' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'integrations', 'manage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    const ownershipError = await verifyTerminalOwnership(
      supabase,
      merchantId,
      code
    );
    if (ownershipError) return ownershipError;

    const result = await deactivateVirtualTerminal(code);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const syncError = await syncTerminalRecord(merchantId, code, {
      active: false,
    });
    if (syncError) return syncError;

    const legacyClearWarning = await clearLegacyTerminalCode(
      supabase,
      merchantId,
      code
    );

    return NextResponse.json({
      success: true,
      message: 'Virtual Terminal deactivated',
      ...(legacyClearWarning ? { legacyClearWarning } : {}),
    });
  } catch (error) {
    logger.error({ message: 'Virtual Terminal deactivation error', error });
    return NextResponse.json(
      { error: 'Failed to deactivate Virtual Terminal' },
      { status: 500 }
    );
  }
}
