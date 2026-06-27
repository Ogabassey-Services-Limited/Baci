import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  MyCoverPolicyInspectionState,
  MyCoverPolicyLookup,
  MyCoverWebhookData,
} from './webhook-types';

export function normalizeMyCoverHostedLink(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.toLowerCase();
    const isMyCoverHost =
      hostname === 'mycover.ai' || hostname.endsWith('.mycover.ai');
    return url.protocol === 'https:' && isMyCoverHost ? url.toString() : null;
  } catch {
    return null;
  }
}

export function getHostedFlowLinks(data: MyCoverWebhookData): {
  claim_link?: string;
  inspection_link?: string;
} {
  const links: { claim_link?: string; inspection_link?: string } = {};
  const claimLink = normalizeMyCoverHostedLink(data.sdk?.claim_link);
  const inspectionLink = normalizeMyCoverHostedLink(data.sdk?.inspection_link);
  if (claimLink) links.claim_link = claimLink;
  if (inspectionLink) links.inspection_link = inspectionLink;
  return links;
}

export async function getCurrentPolicyInspectionState(
  supabase: SupabaseClient,
  lookup: MyCoverPolicyLookup
): Promise<MyCoverPolicyInspectionState | null> {
  const { data, error } = await supabase
    .from('order_insurance_policies')
    .select('inspection_status, inspection_link')
    .eq(lookup.column, lookup.value)
    .maybeSingle<MyCoverPolicyInspectionState>();

  if (error) {
    console.error('[MyCover Webhook] Failed to load inspection state:', error);
    throw error;
  }

  return data ?? null;
}

export function shouldResetInspectionToPending(
  hostedFlowLinks: { inspection_link?: string },
  currentState: MyCoverPolicyInspectionState | null
) {
  if (!hostedFlowLinks.inspection_link) return false;

  const currentInspectionLink = currentState?.inspection_link?.trim() ?? null;

  // MyCover can replay purchase/policy detail updates with the same hosted
  // inspection URL. Only re-arm the activation reminder when a new URL appears
  // or the policy previously had no URL; otherwise one-time reminders can be
  // sent repeatedly while the inspection remains pending.
  return currentInspectionLink !== hostedFlowLinks.inspection_link;
}

export function hostedFlowUpdateColumns(
  hostedFlowLinks: { claim_link?: string; inspection_link?: string },
  currentState: MyCoverPolicyInspectionState | null
) {
  return {
    ...hostedFlowLinks,
    ...(shouldResetInspectionToPending(hostedFlowLinks, currentState)
      ? {
          activation_reminder_sent_at: null,
          inspection_status: 'pending',
        }
      : {}),
  };
}
