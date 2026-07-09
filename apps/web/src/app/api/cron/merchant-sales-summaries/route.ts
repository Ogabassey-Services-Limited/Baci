import { NextResponse } from 'next/server';
import { getCronSecret } from '@/env';
import { hasValidCronSecret } from '@/lib/cron-secret-auth';
import {
  buildMerchantSalesSummaryEmail,
  type MerchantSalesSummaryPeriod,
  type MerchantSalesSummaryRow,
} from '@/lib/merchant-sales-summary-email';
import { resolveMerchantCurrencyConfig } from '@/lib/resolve-merchant-currency';
import { createServiceClient } from '@/lib/supabase/service';
import { sendEmail } from '@/lib/zeptomail';
import { merchantSalesSummaryCronQuerySchema } from '@/schemas/merchant-sales-summary-cron-query';

const SALES_SUMMARY_SELECT =
  'merchant_id, avg_order_value, order_count, paid_orders, paid_revenue, pending_orders, sale_date, total_revenue, unique_customers' as const;

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function resolveDateWindow(period: MerchantSalesSummaryPeriod, date?: string) {
  const end = date ? new Date(`${date}T00:00:00.000Z`) : new Date();
  if (!date) end.setUTCDate(end.getUTCDate() - 1);

  const start = new Date(end);
  if (period === 'weekly') start.setUTCDate(start.getUTCDate() - 6);

  return { endDate: toDateOnly(end), startDate: toDateOnly(start) };
}

type SalesSummaryRow = MerchantSalesSummaryRow & {
  merchant_id: string;
  sale_date: string;
};

type MerchantRow = {
  business_name: string | null;
  country: string | null;
  email: string;
  email_sender_name: string | null;
  id: string;
  payout_currency: string | null;
};

export async function GET(request: Request) {
  if (!hasValidCronSecret(request.headers, getCronSecret())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsedQuery = merchantSalesSummaryCronQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams)
  );
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsedQuery.error.flatten() },
      { status: 400 }
    );
  }

  const { endDate, startDate } = resolveDateWindow(
    parsedQuery.data.period,
    parsedQuery.data.date
  );
  const supabase = createServiceClient();
  const { data: rows, error: summaryError } = await supabase
    .from('daily_sales_summary')
    .select(SALES_SUMMARY_SELECT)
    .gte('sale_date', startDate)
    .lte('sale_date', endDate);

  if (summaryError) {
    console.error('Failed to load merchant sales summaries', summaryError);
    return NextResponse.json(
      { error: 'Failed to load sales summaries' },
      { status: 500 }
    );
  }

  const salesRows = (rows ?? []) as SalesSummaryRow[];
  const merchantIds = Array.from(
    new Set(salesRows.map((row) => row.merchant_id))
  );
  if (merchantIds.length === 0) {
    return NextResponse.json({
      endDate,
      period: parsedQuery.data.period,
      sent: 0,
      startDate,
      success: true,
    });
  }

  const { data: merchants, error: merchantError } = await supabase
    .from('merchants')
    .select(
      'id, email, business_name, country, email_sender_name, payout_currency'
    )
    .in('id', merchantIds);

  if (merchantError) {
    console.error(
      'Failed to load merchants for sales summaries',
      merchantError
    );
    return NextResponse.json(
      { error: 'Failed to load merchants' },
      { status: 500 }
    );
  }

  const merchantsById = new Map(
    ((merchants ?? []) as MerchantRow[]).map((merchant) => [
      merchant.id,
      merchant,
    ])
  );
  const results = await Promise.allSettled(
    merchantIds.map(async (merchantId) => {
      const merchant = merchantsById.get(merchantId);
      if (!merchant?.email) return { merchantId, status: 'skipped' as const };

      const merchantRows = salesRows.filter(
        (row) => row.merchant_id === merchantId
      );
      const businessName =
        merchant.business_name || merchant.email_sender_name || 'Your store';
      const email = buildMerchantSalesSummaryEmail({
        businessName,
        currency: resolveMerchantCurrencyConfig(merchant).code,
        period: parsedQuery.data.period,
        rows: merchantRows,
      });

      const result = await sendEmail({
        auditContext: {
          merchantId,
          metadata: {
            endDate,
            period: parsedQuery.data.period,
            sequenceId: `merchant-${parsedQuery.data.period}-sales-summary`,
            startDate,
          },
        },
        clientReference: `merchant-sales-summary:${parsedQuery.data.period}:${merchantId}:${startDate}:${endDate}`,
        emailType: 'notifications',
        fromName: `${businessName} Reports`,
        htmlContent: email.htmlContent,
        subject: email.subject,
        textContent: email.textContent,
        to: merchant.email,
      });

      return {
        merchantId,
        status: result.success ? ('sent' as const) : ('failed' as const),
      };
    })
  );

  const sent = results.filter(
    (result) => result.status === 'fulfilled' && result.value.status === 'sent'
  ).length;
  const failed = results.length - sent;

  return NextResponse.json({
    endDate,
    failed,
    period: parsedQuery.data.period,
    sent,
    startDate,
    success: failed === 0,
  });
}

export const POST = GET;
