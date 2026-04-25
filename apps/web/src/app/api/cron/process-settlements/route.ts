import { NextResponse } from 'next/server';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import { logger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';
import { sendEmail } from '@/lib/zeptomail';

/**
 * POST /api/cron/process-settlements
 *
 * Manual fallback only - DO NOT re-enable Vercel Cron for this route.
 * Scheduled execution lives in vps-workers; keep CRON_SECRET gating intact.
 *
 * Daily settlement job to:
 * 1. Process settlements that have reached their expected date
 * 2. Send notifications to merchants about new settlements
 *
 * Security: Requires CRON_SECRET header
 */
export async function POST(request: Request) {
  try {
    // Verify cron secret
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (
      !cronSecret ||
      !expectedSecret ||
      !constantTimeEqual(cronSecret, expectedSecret)
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();

    // 1. Process due settlements
    const { data: processResult, error: processError } = await supabase.rpc(
      'process_due_settlements'
    );

    if (processError) {
      logger.error({
        message: 'Failed to process due settlements',
        error: processError,
      });
      return NextResponse.json(
        { error: 'Failed to process settlements' },
        { status: 500 }
      );
    }

    const result = processResult?.[0] || {
      processed_count: 0,
      total_amount: 0,
      details: [],
    };

    logger.info({
      message: 'Processed due settlements',
      processedCount: result.processed_count,
      totalAmount: result.total_amount,
    });

    // 2. Get settlements that need notifications
    const { data: pendingNotifications, error: notifyError } = await supabase
      .from('merchant_settlements')
      .select(
        `
        id,
        merchant_id,
        net_amount,
        gateway,
        source_type,
        description,
        actual_settlement_date,
        merchants (
          id,
          business_name,
          users (
            id,
            email
          )
        )
      `
      )
      .eq('status', 'settled')
      .eq('settlement_notified', false)
      .order('actual_settlement_date', { ascending: true })
      .limit(50); // Process in batches

    if (notifyError) {
      logger.warn({
        message: 'Failed to fetch pending notifications',
        error: notifyError,
      });
    }

    // 3. Send notifications
    const notificationResults = {
      sent: 0,
      failed: 0,
    };

    if (pendingNotifications && pendingNotifications.length > 0) {
      // Group settlements by merchant for batch notifications
      const merchantSettlements = new Map<
        string,
        {
          merchantId: string;
          businessName: string;
          email: string;
          settlements: Array<{
            id: string;
            amount: number;
            gateway: string;
            description: string;
          }>;
          totalAmount: number;
        }
      >();

      for (const settlement of pendingNotifications) {
        const merchant = settlement.merchants as unknown as {
          id: string;
          business_name: string;
          users: { id: string; email: string };
        };

        if (!merchant?.users?.email) continue;

        const key = merchant.id;
        const existing = merchantSettlements.get(key);

        if (existing) {
          existing.settlements.push({
            id: settlement.id,
            amount: Number(settlement.net_amount),
            gateway: settlement.gateway,
            description: settlement.description || 'Payment',
          });
          existing.totalAmount += Number(settlement.net_amount);
        } else {
          merchantSettlements.set(key, {
            merchantId: merchant.id,
            businessName: merchant.business_name,
            email: merchant.users.email,
            settlements: [
              {
                id: settlement.id,
                amount: Number(settlement.net_amount),
                gateway: settlement.gateway,
                description: settlement.description || 'Payment',
              },
            ],
            totalAmount: Number(settlement.net_amount),
          });
        }
      }

      // Send one email per merchant
      for (const [, data] of merchantSettlements) {
        try {
          const settlementIds = data.settlements.map((s) => s.id);

          await sendSettlementNotification(data);

          // Mark as notified
          await supabase
            .from('merchant_settlements')
            .update({
              settlement_notified: true,
              notification_sent_at: new Date().toISOString(),
            })
            .in('id', settlementIds);

          notificationResults.sent++;
        } catch (emailError) {
          logger.error({
            message: 'Failed to send settlement notification',
            merchantId: data.merchantId,
            error: emailError,
          });
          notificationResults.failed++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      settlements: {
        processed: result.processed_count,
        totalAmount: result.total_amount,
      },
      notifications: notificationResults,
    });
  } catch (error) {
    logger.error({
      message: 'Settlement processing cron error',
      error,
    });
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}

/**
 * Send settlement notification email to merchant
 */
async function sendSettlementNotification(data: {
  merchantId: string;
  businessName: string;
  email: string;
  settlements: Array<{
    id: string;
    amount: number;
    gateway: string;
    description: string;
  }>;
  totalAmount: number;
}) {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
  const dashboardUrl = `https://dashboard.${rootDomain}/dashboard/wallet`;

  const settlementRows = data.settlements
    .map(
      (s) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">${s.description}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-transform: capitalize;">${s.gateway}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; font-weight: 500;">
            ₦${s.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
          </td>
        </tr>
      `
    )
    .join('');

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">💰 Funds Settled!</h1>
      </div>

      <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="color: #374151; font-size: 16px; margin-top: 0;">
          Hi ${data.businessName},
        </p>

        <p style="color: #374151; font-size: 16px;">
          Great news! Your funds have been settled and are now available in your wallet.
        </p>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
          <p style="margin: 0 0 8px; color: #166534; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
            Total Settled
          </p>
          <p style="margin: 0; color: #15803d; font-size: 32px; font-weight: 700;">
            ₦${data.totalAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Description</th>
              <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Source</th>
              <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${settlementRows}
          </tbody>
        </table>

        <div style="text-align: center; margin-top: 30px;">
          <a href="${dashboardUrl}"
             style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            View Your Wallet
          </a>
        </div>

        <p style="color: #6b7280; font-size: 14px; margin-top: 30px; text-align: center;">
          You can withdraw these funds anytime from your dashboard.
        </p>
      </div>

      <div style="background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="margin: 0; color: #6b7280; font-size: 12px;">
          This is an automated notification from Baci.
        </p>
      </div>
    </div>
  `;

  await sendEmail({
    to: data.email,
    toName: data.businessName,
    subject: `💰 ₦${data.totalAmount.toLocaleString()} settled to your wallet`,
    htmlContent,
    emailType: 'notifications',
  });
}

// Allow GET for testing in development
export function GET(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const mockRequest = new Request(request.url, {
    method: 'POST',
    headers: {
      'x-cron-secret': process.env.CRON_SECRET || 'dev-secret',
    },
  });

  return POST(mockRequest);
}
