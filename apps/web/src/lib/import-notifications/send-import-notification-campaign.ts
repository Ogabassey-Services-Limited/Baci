import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildReceiptNotificationEmailContent,
  type MerchantNotificationContext,
  resolveReceiptNotificationDelivery,
} from '@/lib/import-notifications/import-notification-email-content';
import {
  buildReceiptClaimUrl,
  buildReceiptDeviceList,
  createReceiptClaimToken,
  normalizeClaimEmail,
  type ReceiptClaimOrderForDeviceList,
} from '@/lib/import-notifications/receipt-claim-links';
import { sendEmail } from '@/lib/zeptomail';

interface NotificationOrderItem {
  name: string | null;
  quantity: number | null;
}
interface NotificationRecipientOrder {
  id: string;
  customer_email: string | null;
  customer_name: string | null;
  customer_id: string | null;
  order_number: string;
  payment_status: string;
  shipping_status: string;
  order_items?: NotificationOrderItem[] | null;
}
interface NotificationRecipient {
  email: string;
  customerId: string | null;
  customerName: string | null;
  orders: NotificationRecipientOrder[];
}
interface SendImportNotificationCampaignInput {
  supabase: SupabaseClient;
  importJobId: string;
  merchant: MerchantNotificationContext;
  customSettings: Record<string, unknown> | null;
}
interface SendImportNotificationCampaignResult {
  sentCount: number;
  skippedCount: number;
  failedCount: number;
}
interface CreatedReceiptClaimLink {
  claimId: string;
  claimUrl: string;
}

function groupOrdersByRecipient(orders: NotificationRecipientOrder[]) {
  const recipientsByEmail = new Map<string, NotificationRecipient>();

  for (const order of orders) {
    const normalizedEmail = normalizeClaimEmail(order.customer_email);
    if (!normalizedEmail) {
      continue;
    }

    const existing = recipientsByEmail.get(normalizedEmail);
    if (existing) {
      existing.orders.push(order);
      existing.customerId = existing.customerId || order.customer_id;
      existing.customerName = existing.customerName || order.customer_name;
      continue;
    }

    recipientsByEmail.set(normalizedEmail, {
      email: normalizedEmail,
      customerId: order.customer_id,
      customerName: order.customer_name,
      orders: [order],
    });
  }

  return recipientsByEmail;
}

async function createClaimLinkForRecipient({
  supabase,
  importJobId,
  merchant,
  recipient,
}: {
  supabase: SupabaseClient;
  importJobId: string;
  merchant: MerchantNotificationContext;
  recipient: NotificationRecipient;
}): Promise<CreatedReceiptClaimLink | null> {
  if (!recipient.customerId) {
    return null;
  }

  const normalizedEmail = normalizeClaimEmail(recipient.email);
  if (!normalizedEmail) {
    return null;
  }

  const { data: existingClaim, error: existingClaimError } = await supabase
    .from('receipt_claims')
    .select('id')
    .eq('import_job_id', importJobId)
    .eq('customer_email_normalized', normalizedEmail)
    .maybeSingle();

  if (existingClaimError) {
    throw new Error(
      `Failed to check existing receipt claim: ${existingClaimError.message}`
    );
  }

  if (existingClaim) {
    // TODO: Existing rows do not store the raw token, so failed-send retries
    // need explicit delivery state before they can safely resend claim links.
    return null;
  }

  const claimToken = createReceiptClaimToken();
  const { data: claim, error: claimError } = await supabase
    .from('receipt_claims')
    .insert({
      merchant_id: merchant.id,
      import_job_id: importJobId,
      customer_id: recipient.customerId,
      customer_email: recipient.email,
      customer_name: recipient.customerName,
      token_hash: claimToken.tokenHash,
      claimed_at: null,
      claimed_by_user_id: null,
    })
    .select('id')
    .single();

  if (claimError || !claim) {
    throw new Error(`Failed to create receipt claim: ${claimError?.message}`);
  }

  const claimOrderRows = recipient.orders.map((order) => ({
    receipt_claim_id: claim.id,
    order_id: order.id,
  }));

  if (claimOrderRows.length > 0) {
    const { error: claimOrdersError } = await supabase
      .from('receipt_claim_orders')
      .upsert(claimOrderRows, { onConflict: 'receipt_claim_id,order_id' });

    if (claimOrdersError) {
      await deleteReceiptClaim({
        claimId: claim.id,
        supabase,
      });
      throw new Error(
        `Failed to attach receipt claim orders: ${claimOrdersError.message}`
      );
    }
  }

  return {
    claimId: claim.id,
    claimUrl: buildReceiptClaimUrl({
      merchant,
      token: claimToken.token,
    }),
  };
}

async function deleteReceiptClaim({
  supabase,
  claimId,
}: {
  supabase: SupabaseClient;
  claimId: string;
}) {
  const { error } = await supabase
    .from('receipt_claims')
    .delete()
    .eq('id', claimId);

  if (error) {
    throw new Error(`Failed to delete unsent receipt claim: ${error.message}`);
  }
}

export async function sendImportNotificationCampaign({
  supabase,
  importJobId,
  merchant,
  customSettings,
}: SendImportNotificationCampaignInput): Promise<SendImportNotificationCampaignResult> {
  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, customer_id, customer_email, customer_name, order_number, payment_status, shipping_status, order_items(name, quantity)'
    )
    .eq('merchant_id', merchant.id)
    .eq('import_job_id', importJobId)
    .not('customer_email', 'is', null);

  if (error) {
    throw new Error(
      `Failed to load imported order recipients: ${error.message}`
    );
  }

  const recipientsByEmail = groupOrdersByRecipient(
    (data || []) as NotificationRecipientOrder[]
  );
  const delivery = resolveReceiptNotificationDelivery(merchant, customSettings);

  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const recipient of recipientsByEmail.values()) {
    let createdClaim: CreatedReceiptClaimLink | null = null;
    let receiptUrl = delivery.receiptsUrl;

    if (delivery.accessMode === 'app_first') {
      createdClaim = await createClaimLinkForRecipient({
        supabase,
        importJobId,
        merchant,
        recipient,
      });

      if (!createdClaim) {
        skippedCount += 1;
        continue;
      }

      receiptUrl = createdClaim.claimUrl;
    } else if (!recipient.customerId) {
      skippedCount += 1;
      continue;
    }

    const devices = buildReceiptDeviceList(
      recipient.orders as ReceiptClaimOrderForDeviceList[]
    );
    const content = buildReceiptNotificationEmailContent({
      delivery,
      merchant,
      recipientName: recipient.customerName || 'there',
      claimUrl: receiptUrl,
      devices,
    });

    const result = await sendEmail({
      to: recipient.email,
      toName: recipient.customerName || undefined,
      subject: content.subject,
      htmlContent: content.htmlContent,
      textContent: content.textContent,
      replyTo: merchant.support_email || merchant.email || undefined,
      emailType: 'orders',
      fromName: content.fromName,
    }).catch(async (error: unknown) => {
      if (createdClaim) {
        await deleteReceiptClaim({ claimId: createdClaim.claimId, supabase });
      }

      throw error;
    });

    if (result.success) {
      sentCount += 1;
      continue;
    }

    if (createdClaim) {
      await deleteReceiptClaim({ claimId: createdClaim.claimId, supabase });
    }

    failedCount += 1;
  }

  return {
    sentCount,
    skippedCount,
    failedCount,
  };
}
