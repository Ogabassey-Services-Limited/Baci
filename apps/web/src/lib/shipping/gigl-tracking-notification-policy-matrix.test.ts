import { describe, expect, it } from 'vitest';
import {
  GIGL_TRACKING_NOTIFICATION_AUDIENCES,
  GIGL_TRACKING_NOTIFICATION_KINDS,
  GIGL_TRACKING_NOTIFICATION_POLICY_MATRIX,
  getGiglTrackingNotificationPolicies,
} from './gigl-tracking-notification-policy-matrix';

describe('GIGL tracking notification policy matrix', () => {
  it('uses one valid selector and a supported audience and kind for every policy', () => {
    const tuples = new Set<string>();

    for (const policy of GIGL_TRACKING_NOTIFICATION_POLICY_MATRIX) {
      expect('rawStatus' in policy).not.toBe('normalizedStatus' in policy);
      expect(GIGL_TRACKING_NOTIFICATION_AUDIENCES).toContain(policy.audience);
      expect(GIGL_TRACKING_NOTIFICATION_KINDS).toContain(
        policy.notificationKind
      );
      if ('rawStatus' in policy) {
        expect(policy.rawStatus).toBe(policy.rawStatus.toUpperCase());
      } else {
        expect(policy.normalizedStatus).toBe(
          policy.normalizedStatus.toLowerCase()
        );
      }

      const selector =
        'rawStatus' in policy
          ? `raw:${policy.rawStatus}`
          : `normalized:${policy.normalizedStatus}`;
      const tuple = `${selector}:${policy.audience}:${policy.notificationKind}`;
      expect(tuples.has(tuple)).toBe(false);
      tuples.add(tuple);
    }
  });

  it('uses explicit raw status policies before normalized-status policies', () => {
    expect(
      getGiglTrackingNotificationPolicies(
        ' rider en route for pickup ',
        'pickup_scheduled'
      )
    ).toEqual([
      {
        audience: 'merchant',
        rawStatus: 'RIDER EN ROUTE FOR PICKUP',
        notificationKind: 'pickup_en_route',
      },
    ]);
  });

  it('returns all normalized policies when no raw-specific policy exists', () => {
    expect(
      getGiglTrackingNotificationPolicies('Delivery failed', 'failed')
    ).toEqual([
      {
        audience: 'merchant',
        normalizedStatus: 'failed',
        notificationKind: 'failed',
      },
      {
        audience: 'customer',
        normalizedStatus: 'failed',
        notificationKind: 'delivery_attempt_failed',
      },
    ]);
  });

  it('does not emit notifications for unrecognized non-actionable status', () => {
    expect(
      getGiglTrackingNotificationPolicies('Shipment created', 'pending')
    ).toEqual([]);
  });
});
