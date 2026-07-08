import { getCachedMerchantById } from '@/lib/cached-data';
import {
  generateRepairStatusUpdateEmail,
  generateRepairStatusUpdateText,
} from '@/lib/email-templates';
import { notifyCustomer } from '@/lib/expo-push';
import {
  REPAIR_STATUS_LABELS,
  type RepairStatus,
} from '@/lib/repairs/repair-status';
import { createClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/zeptomail';

export interface NotifyRepairStatusChangeParams {
  merchantId: string;
  repairId: string;
  ticketNumber: number;
  customerName: string;
  customerEmail: string;
  deviceLabel: string;
  status: RepairStatus;
}

/**
 * Best-effort resolution of a storefront customer's auth user id from their
 * booking email, so we can push to a logged-in customer. Repairs store only the
 * email (no user link), so this is a soft match and may return null.
 */
async function resolveCustomerUserId(
  merchantId: string,
  email: string
): Promise<string | null> {
  try {
    const admin = createClient();
    const { data } = await admin
      .from('customers')
      .select('user_id')
      .eq('merchant_id', merchantId)
      .ilike('email', email)
      .not('user_id', 'is', null)
      .limit(1)
      .maybeSingle();
    const userId = (data as { user_id?: unknown } | null)?.user_id;
    return typeof userId === 'string' ? userId : null;
  } catch (error) {
    console.error('Error resolving repair customer for push:', error);
    return null;
  }
}

/**
 * Notify the customer that their repair status changed: a push (for a
 * logged-in customer) plus a status email. Both are best-effort — every
 * external call is individually caught and logged so a notification failure can
 * never turn a successful status update into a failed request.
 */
export async function notifyRepairStatusChange(
  params: NotifyRepairStatusChangeParams
): Promise<void> {
  try {
    const userId = await resolveCustomerUserId(
      params.merchantId,
      params.customerEmail
    );
    if (userId) {
      await notifyCustomer(
        userId,
        `Repair ${REPAIR_STATUS_LABELS[params.status]}`,
        `${params.deviceLabel} (Ticket #${params.ticketNumber})`,
        { type: 'repair', repair_id: params.repairId },
        'orders'
      );
    }
  } catch (error) {
    console.error('Error sending repair status push:', error);
  }

  try {
    const merchant = await getCachedMerchantById(params.merchantId).catch(
      () => null
    );
    const merchantName = merchant?.business_name || 'the store';
    const emailData = {
      ticketNumber: params.ticketNumber,
      customerName: params.customerName,
      merchantName,
      deviceLabel: params.deviceLabel,
      status: params.status,
    };

    const result = await sendEmail({
      auditContext: {
        merchantId: params.merchantId,
        metadata: {
          repairId: params.repairId,
          ticketNumber: params.ticketNumber,
          status: params.status,
        },
      },
      emailType: 'orders',
      htmlContent: generateRepairStatusUpdateEmail(emailData),
      merchantId: params.merchantId,
      subject: `Repair update — Ticket #${params.ticketNumber}`,
      textContent: generateRepairStatusUpdateText(emailData),
      to: params.customerEmail,
      toName: params.customerName,
    });

    if (!result.success) {
      console.error('Error sending repair status email:', result.error);
    }
  } catch (error) {
    console.error('Error sending repair status email:', error);
  }
}
