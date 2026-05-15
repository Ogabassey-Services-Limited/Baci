import { describe, expect, it } from 'vitest';
import { agenticActionCenterCardHelpers } from '@/components/dashboard/agentic-action-center-card-helpers';
import type { AgenticAction } from '@/schemas/agentic-action-health';

const validAction: AgenticAction = {
  code: 'AGENTIC_PAYMENT_PENDING',
  count: 1,
  message: 'Agentic checkouts are waiting for payment confirmation.',
  severity: 'monitor',
};

describe('getActionHref', () => {
  it('maps reviewable agentic action codes to order review', () => {
    expect(
      agenticActionCenterCardHelpers.getActionHref('AGENTIC_IDEMPOTENCY_ERRORS')
    ).toBe('/dashboard/orders?source=agentic');
    expect(
      agenticActionCenterCardHelpers.getActionHref(
        'AGENTIC_IDEMPOTENCY_STALE_IN_PROGRESS'
      )
    ).toBe('/dashboard/orders?source=agentic');
    expect(
      agenticActionCenterCardHelpers.getActionHref('AGENTIC_ORDER_FINALIZING')
    ).toBe('/dashboard/orders?source=agentic');
    expect(
      agenticActionCenterCardHelpers.getActionHref('AGENTIC_PAYMENT_PENDING')
    ).toBe('/dashboard/orders?source=agentic');
    expect(
      agenticActionCenterCardHelpers.getActionHref(
        'AGENTIC_REQUESTS_IN_PROGRESS'
      )
    ).toBe('/dashboard/orders?source=agentic');
    expect(
      agenticActionCenterCardHelpers.getActionHref(
        'AGENTIC_AGENT_ALLOWLIST_UNSET'
      )
    ).toBeNull();
    expect(agenticActionCenterCardHelpers.getActionHref('UNKNOWN')).toBeNull();
  });
});

describe('formatGeneratedAt', () => {
  it('formats valid timestamps and ignores missing or invalid input', () => {
    expect(agenticActionCenterCardHelpers.formatGeneratedAt()).toBeNull();
    expect(
      agenticActionCenterCardHelpers.formatGeneratedAt('not-a-date')
    ).toBeNull();
    expect(
      agenticActionCenterCardHelpers.formatGeneratedAt(
        '2026-05-15T03:00:00.000Z'
      )
    ).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe('sumActionCounts', () => {
  it('sums finite positive action counts without subtracting negatives', () => {
    expect(
      agenticActionCenterCardHelpers.sumActionCounts([
        { ...validAction, count: 3 },
        { ...validAction, count: -2 },
        { ...validAction, count: 0 },
      ])
    ).toBe(3);
  });
});

describe('buildAgenticDashboardBriefing', () => {
  it('summarizes empty actions as clear', () => {
    expect(
      agenticActionCenterCardHelpers.buildAgenticDashboardBriefing([])
    ).toEqual({
      attentionCount: 0,
      monitorCount: 0,
      needsAttention: 'No action needed right now.',
      nextMove: 'Keep catalog, trust, and payment settings current.',
      whatChanged: 'No new agentic recovery issues since the last refresh.',
    });
  });

  it('summarizes attention actions into an operational next step', () => {
    expect(
      agenticActionCenterCardHelpers.buildAgenticDashboardBriefing([
        {
          code: 'AGENTIC_ORDER_FINALIZING',
          count: 2,
          message:
            'Agentic checkouts are waiting on order finalization recovery.',
          severity: 'attention',
        },
        {
          code: 'AGENTIC_PAYMENT_PENDING',
          count: 1,
          message: 'Agentic checkouts are waiting for payment confirmation.',
          severity: 'monitor',
        },
      ])
    ).toEqual({
      attentionCount: 2,
      monitorCount: 1,
      needsAttention:
        'Agentic checkouts are waiting on order finalization recovery.',
      nextMove: 'Review affected checkout activity before agents retry.',
      whatChanged: '2 agentic checkout issues need attention.',
    });
  });

  it('uses the first attention message when multiple attention actions exist', () => {
    expect(
      agenticActionCenterCardHelpers.buildAgenticDashboardBriefing([
        {
          code: 'AGENTIC_IDEMPOTENCY_ERRORS',
          count: 1,
          message: 'Recent agentic retries ended with server errors.',
          severity: 'attention',
        },
        {
          code: 'AGENTIC_ORDER_FINALIZING',
          count: 2,
          message:
            'Agentic checkouts are waiting on order finalization recovery.',
          severity: 'attention',
        },
      ])
    ).toEqual({
      attentionCount: 3,
      monitorCount: 0,
      needsAttention: 'Recent agentic retries ended with server errors.',
      nextMove: 'Review affected checkout activity before agents retry.',
      whatChanged: '3 agentic checkout issues need attention.',
    });
  });

  it('uses the first positive-count attention message for active blockers', () => {
    expect(
      agenticActionCenterCardHelpers.buildAgenticDashboardBriefing([
        {
          code: 'AGENTIC_IDEMPOTENCY_ERRORS',
          count: 0,
          message: 'Recent agentic retries ended with server errors.',
          severity: 'attention',
        },
        {
          code: 'AGENTIC_ORDER_FINALIZING',
          count: 2,
          message:
            'Agentic checkouts are waiting on order finalization recovery.',
          severity: 'attention',
        },
      ])
    ).toEqual({
      attentionCount: 2,
      monitorCount: 0,
      needsAttention:
        'Agentic checkouts are waiting on order finalization recovery.',
      nextMove: 'Review affected checkout activity before agents retry.',
      whatChanged: '2 agentic checkout issues need attention.',
    });
  });

  it('summarizes monitor-only actions separately from blockers', () => {
    expect(
      agenticActionCenterCardHelpers.buildAgenticDashboardBriefing([
        {
          code: 'AGENTIC_PAYMENT_PENDING',
          count: 3,
          message: 'Agentic checkouts are waiting for payment confirmation.',
          severity: 'monitor',
        },
      ])
    ).toEqual({
      attentionCount: 0,
      monitorCount: 3,
      needsAttention: 'No blockers, but payment or order status is moving.',
      nextMove: 'Review pending activity if the count does not fall.',
      whatChanged: '3 agentic checkout items are active.',
    });
  });

  it('treats negative counts as zero and falls through to clear or monitor state', () => {
    expect(
      agenticActionCenterCardHelpers.buildAgenticDashboardBriefing([
        {
          code: 'AGENTIC_ORDER_FINALIZING',
          count: -1,
          message:
            'Agentic checkouts are waiting on order finalization recovery.',
          severity: 'attention',
        },
      ])
    ).toEqual({
      attentionCount: 0,
      monitorCount: 0,
      needsAttention: 'No action needed right now.',
      nextMove: 'Keep catalog, trust, and payment settings current.',
      whatChanged: 'No new agentic recovery issues since the last refresh.',
    });

    expect(
      agenticActionCenterCardHelpers.buildAgenticDashboardBriefing([
        {
          code: 'AGENTIC_ORDER_FINALIZING',
          count: 0,
          message:
            'Agentic checkouts are waiting on order finalization recovery.',
          severity: 'attention',
        },
        {
          code: 'AGENTIC_PAYMENT_PENDING',
          count: 2,
          message: 'Agentic checkouts are waiting for payment confirmation.',
          severity: 'monitor',
        },
      ])
    ).toEqual({
      attentionCount: 0,
      monitorCount: 2,
      needsAttention: 'No blockers, but payment or order status is moving.',
      nextMove: 'Review pending activity if the count does not fall.',
      whatChanged: '2 agentic checkout items are active.',
    });
  });

  it('summarizes ok-only actions as clear', () => {
    expect(
      agenticActionCenterCardHelpers.buildAgenticDashboardBriefing([
        {
          code: 'AGENTIC_ACTIONS_HEALTHY',
          count: 0,
          message: 'No recent agentic action issues need attention.',
          severity: 'ok',
        },
      ])
    ).toEqual({
      attentionCount: 0,
      monitorCount: 0,
      needsAttention: 'No action needed right now.',
      nextMove: 'Keep catalog, trust, and payment settings current.',
      whatChanged: 'No new agentic recovery issues since the last refresh.',
    });
  });
});
