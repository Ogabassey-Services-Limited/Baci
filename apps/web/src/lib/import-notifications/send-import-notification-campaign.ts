import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildReceiptNotificationEmailContent,
  type MerchantNotificationContext,
  resolveReceiptNotificationDelivery,
} from '@/lib/import-notifications/import-notification-email-content';
import {
  deleteReceiptClaim,
  markReceiptClaimNotificationSent,
} from '@/lib/import-notifications/receipt-claim-delivery-state';
import {
  buildReceiptClaimUrl,
  buildReceiptDeviceList,
  createReceiptClaimToken,
  normalizeClaimEmail,
  type ReceiptClaimOrderForDeviceList,
} from '@/lib/import-notifications/receipt-claim-links';
import { sendEmail } from '@/lib/zeptomail';
import { createReceiptClaimResultSchema } from '@/schemas/receipt-claim-rpc';

interface NotificationOrderItem {
  name: string | null;
  quantity: number | null;
}
interface NotificationRecipientOrder extends ReceiptClaimOrderForDeviceList {
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
  const recipientsByIdentity = new Map<string, NotificationRecipient>();

  for (const order of orders) {
    const normalizedEmail = normalizeClaimEmail(order.customer_email);
    if (!normalizedEmail) {
      continue;
    }

    const recipientKey = `${normalizedEmail}:${order.customer_id ?? 'guest'}`;
    const existing = recipientsByIdentity.get(recipientKey);
    if (existing) {
      existing.orders.push(order);
      existing.customerId = existing.customerId || order.customer_id;
      existing.customerName = existing.customerName || order.customer_name;
      continue;
    }

    recipientsByIdentity.set(recipientKey, {
      email: normalizedEmail,
      customerId: order.customer_id,
      customerName: order.customer_name,
      orders: [order],
    });
  }

  return recipientsByIdentity;
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

  const claimToken = createReceiptClaimToken();
  const { data, error } = await supabase.rpc(
    'create_receipt_claim_for_import_notification',
    {
      p_customer_email: recipient.email,
      p_customer_id: recipient.customerId,
      p_customer_name: recipient.customerName,
      p_import_job_id: importJobId,
      p_merchant_id: merchant.id,
      p_order_ids: recipient.orders.map((order) => order.id),
      p_token_hash: claimToken.tokenHash,
    }
  );

  if (error) {
    throw new Error(`Failed to create receipt claim: ${error.message}`);
  }

  const parsedResult = createReceiptClaimResultSchema.safeParse(data);
  if (!parsedResult.success) {
    throw new Error(
      'Failed to create receipt claim: invalid response structure'
    );
  }

  if (parsedResult.data.status !== 'created' || !parsedResult.data.claim_id) {
    return null;
  }

  return {
    claimId: parsedResult.data.claim_id,
    claimUrl: buildReceiptClaimUrl({
      merchant,
      token: claimToken.token,
    }),
  };
}

async function cleanUpUnsentClaim({
  claim,
  supabase,
}: {
  claim: CreatedReceiptClaimLink | null;
  supabase: SupabaseClient;
}) {
  if (!claim) {
    return;
  }

  try {
    await deleteReceiptClaim({ claimId: claim.claimId, supabase });
  } catch (error) {
    console.error('Failed to clean up unsent receipt claim', error);
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

    const devices = buildReceiptDeviceList(recipient.orders);
    const content = buildReceiptNotificationEmailContent({
      delivery,
      merchant,
      recipientName: recipient.customerName || 'there',
      claimUrl: receiptUrl,
      devices,
    });

    let result: Awaited<ReturnType<typeof sendEmail>>;
    try {
      result = await sendEmail({
        to: recipient.email,
        toName: recipient.customerName || undefined,
        subject: content.subject,
        htmlContent: content.htmlContent,
        textContent: content.textContent,
        replyTo: merchant.support_email || merchant.email || undefined,
        emailType: 'orders',
        fromName: content.fromName,
      });
    } catch {
      await cleanUpUnsentClaim({ claim: createdClaim, supabase });
      failedCount += 1;
      continue;
    }

    if (result.success) {
      if (createdClaim) {
        try {
          await markReceiptClaimNotificationSent({
            claimId: createdClaim.claimId,
            supabase,
          });
        } catch (error) {
          console.error('Failed to mark receipt claim notification sent', {
            claimId: createdClaim.claimId,
            error,
            importJobId,
          });
        }
      }

      sentCount += 1;
      continue;
    }

    await cleanUpUnsentClaim({ claim: createdClaim, supabase });

    failedCount += 1;
  }

  return {
    sentCount,
    skippedCount,
    failedCount,
  };
}
