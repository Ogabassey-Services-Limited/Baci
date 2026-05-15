import type { Route } from 'next';
import type { AgenticAction } from '@/schemas/agentic-action-health';

interface AgenticDashboardBriefing {
  attentionCount: number;
  monitorCount: number;
  needsAttention: string;
  nextMove: string;
  whatChanged: string;
}

const AGENTIC_ORDERS_HREF = '/dashboard/orders?source=agentic' as Route;

const BRIEFING_MESSAGES = {
  attentionFallback: 'Agentic checkout issues need review.',
  attentionNextMove: 'Review affected checkout activity before agents retry.',
  attentionWhatChanged: (count: number) =>
    `${count} agentic checkout ${pluralize('issue', count)} ${
      count === 1 ? 'needs' : 'need'
    } attention.`,
  clearNeedsAttention: 'No action needed right now.',
  clearNextMove: 'Keep catalog, trust, and payment settings current.',
  clearWhatChanged: 'No new agentic recovery issues since the last refresh.',
  monitorNeedsAttention: 'No blockers, but payment or order status is moving.',
  monitorNextMove: 'Review pending activity if the count does not fall.',
  monitorWhatChanged: (count: number) =>
    `${count} agentic checkout ${pluralize('item', count)} ${
      count === 1 ? 'is' : 'are'
    } active.`,
};

function getActionHref(code: string): Route | null {
  switch (code) {
    case 'AGENTIC_IDEMPOTENCY_ERRORS':
    case 'AGENTIC_ORDER_FINALIZING':
    case 'AGENTIC_PAYMENT_PENDING':
      return AGENTIC_ORDERS_HREF;
    default:
      return null;
  }
}

function formatGeneratedAt(value?: string): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function buildAgenticDashboardBriefing(
  actions: AgenticAction[]
): AgenticDashboardBriefing {
  const attentionActions = actions.filter(
    (action) => action.severity === 'attention'
  );
  const attentionCount = sumActionCounts(attentionActions);
  const monitorActions = actions.filter(
    (action) => action.severity === 'monitor'
  );
  const monitorCount = sumActionCounts(monitorActions);

  if (attentionCount > 0) {
    const actionableAttention = attentionActions.find(
      (action) => action.count > 0
    );
    return {
      attentionCount,
      monitorCount,
      needsAttention:
        actionableAttention?.message ?? BRIEFING_MESSAGES.attentionFallback,
      nextMove: BRIEFING_MESSAGES.attentionNextMove,
      whatChanged: BRIEFING_MESSAGES.attentionWhatChanged(attentionCount),
    };
  }

  if (monitorCount > 0) {
    return {
      attentionCount,
      monitorCount,
      needsAttention: BRIEFING_MESSAGES.monitorNeedsAttention,
      nextMove: BRIEFING_MESSAGES.monitorNextMove,
      whatChanged: BRIEFING_MESSAGES.monitorWhatChanged(monitorCount),
    };
  }

  return {
    attentionCount,
    monitorCount,
    needsAttention: BRIEFING_MESSAGES.clearNeedsAttention,
    nextMove: BRIEFING_MESSAGES.clearNextMove,
    whatChanged: BRIEFING_MESSAGES.clearWhatChanged,
  };
}

function sumActionCounts(actions: AgenticAction[]): number {
  return actions.reduce(
    (total, action) => total + Math.max(0, action.count),
    0
  );
}

function pluralize(noun: string, count: number) {
  return count === 1 ? noun : `${noun}s`;
}

export const agenticActionCenterCardHelpers = {
  buildAgenticDashboardBriefing,
  formatGeneratedAt,
  getActionHref,
  sumActionCounts,
};
