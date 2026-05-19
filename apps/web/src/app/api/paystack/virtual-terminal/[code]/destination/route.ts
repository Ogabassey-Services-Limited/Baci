/**
 * Virtual Terminal Destination API Routes
 *
 * Manage WhatsApp notification destinations for a Virtual Terminal.
 * Up to 5 staff members can receive payment notifications.
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
  assignVirtualTerminalDestinations,
  unassignVirtualTerminalDestinations,
} from '@/lib/paystack';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ code: string }>;
}

const DestinationSchema = z.object({
  destinations: z
    .array(
      z.object({
        target: z.string().regex(/^\+\d{10,15}$/, 'Invalid phone number'),
        name: z.string().min(1),
      })
    )
    .min(1)
    .max(5),
});

const UnassignSchema = z.object({
  targets: z.array(
    z
      .string()
      .regex(/^\+\d{10,15}$/, 'Invalid phone number (E.164 format required)')
  ),
});

/**
 * POST /api/paystack/virtual-terminal/[code]/destination
 * Add WhatsApp destinations to a Virtual Terminal
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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
    if (!hasPermission(access, 'integrations', 'manage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    // Verify merchant owns this terminal by checking virtual_terminal_code
    const { data: merchantRecord, error: merchantError } = await supabase
      .from('merchants')
      .select('virtual_terminal_code')
      .eq('id', merchantId)
      .maybeSingle();

    if (merchantError) {
      logger.error({
        message: 'Database error fetching merchant record',
        error: merchantError,
      });
      return NextResponse.json(
        { error: 'Database error verifying terminal ownership' },
        { status: 500 }
      );
    }

    if (!merchantRecord || merchantRecord.virtual_terminal_code !== code) {
      return NextResponse.json(
        { error: 'Terminal not found or not authorized' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parseResult = DestinationSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const { destinations } = parseResult.data;

    const result = await assignVirtualTerminalDestinations(code, destinations);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      destinations: result.data,
    });
  } catch (error) {
    logger.error({ message: 'Destination assignment error', error });
    return NextResponse.json(
      { error: 'Failed to add WhatsApp destinations' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/paystack/virtual-terminal/[code]/destination
 * Remove WhatsApp destinations from a Virtual Terminal
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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
    if (!hasPermission(access, 'integrations', 'manage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    // Verify merchant owns this terminal by checking virtual_terminal_code
    const { data: merchantRecord, error: merchantError } = await supabase
      .from('merchants')
      .select('virtual_terminal_code')
      .eq('id', merchantId)
      .maybeSingle();

    if (merchantError) {
      logger.error({
        message: 'Database error fetching merchant record',
        error: merchantError,
      });
      return NextResponse.json(
        { error: 'Database error verifying terminal ownership' },
        { status: 500 }
      );
    }

    if (!merchantRecord || merchantRecord.virtual_terminal_code !== code) {
      return NextResponse.json(
        { error: 'Terminal not found or not authorized' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parseResult = UnassignSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const { targets } = parseResult.data;

    const result = await unassignVirtualTerminalDestinations(code, targets);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Destinations removed',
    });
  } catch (error) {
    logger.error({ message: 'Destination removal error', error });
    return NextResponse.json(
      { error: 'Failed to remove WhatsApp destinations' },
      { status: 500 }
    );
  }
}
