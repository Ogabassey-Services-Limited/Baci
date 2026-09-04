import { matchesResumablePickupDetails } from '@/lib/repairs/matches-resumable-pickup-details';
import { createRepairPickupReceiverClient } from '@/lib/repairs/repair-pickup-receiver-client';
import { repairPickupResumeClaims } from '@/lib/repairs/repair-pickup-resume-claim';
import type { RepairBookingInput } from '@/lib/validations/repair';

type ResumableRepair = { success: true; id: string; ticketNumber: number };

type FindResumablePickupRepairResult =
  | { kind: 'found'; repair: ResumableRepair }
  | { kind: 'none' }
  | { kind: 'error'; error: string };

type ResumablePickupRow = {
  id?: unknown;
  ticket_number?: unknown;
  customer_phone?: unknown;
  device_model?: unknown;
  device_type?: unknown;
  pickup_address?: unknown;
};

/** Reclaim an unpaid pickup only with a signed resume capability. */
export async function findResumablePickupRepair(options: {
  input: RepairBookingInput;
  merchantId: string;
  resumeToken: string | null | undefined;
  secret: string;
}): Promise<FindResumablePickupRepairResult> {
  const claim = repairPickupResumeClaims.verify(
    options.resumeToken,
    options.secret
  );
  if (
    !claim ||
    claim.merchantId !== options.merchantId ||
    claim.customerEmail !== options.input.customerEmail.trim().toLowerCase()
  ) {
    return { kind: 'none' };
  }

  const supabase = createRepairPickupReceiverClient(options.merchantId);
  const { data, error } = await supabase.rpc('find_resumable_repair_pickup', {
    p_merchant_id: options.merchantId,
    p_customer_email: options.input.customerEmail,
    p_repair_id: claim.repairId,
  });

  if (error) {
    console.error('Resumable repair pickup lookup failed:', error);
    return {
      kind: 'error',
      error:
        'We could not resume your saved pickup request. Please try again shortly.',
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') {
    return { kind: 'none' };
  }

  const record = row as ResumablePickupRow;
  const ticketNumber =
    typeof record.ticket_number === 'number'
      ? record.ticket_number
      : Number(record.ticket_number);
  if (
    typeof record.id !== 'string' ||
    record.id !== claim.repairId ||
    !Number.isFinite(ticketNumber)
  ) {
    return { kind: 'none' };
  }

  if (
    !matchesResumablePickupDetails({
      input: options.input,
      saved: record,
    })
  ) {
    return { kind: 'none' };
  }

  return {
    kind: 'found',
    repair: { success: true, id: record.id, ticketNumber },
  };
}
