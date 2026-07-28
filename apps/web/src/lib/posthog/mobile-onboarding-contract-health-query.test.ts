import { describe, expect, it } from 'vitest';
import { MOBILE_ONBOARDING_CONTRACT_HEALTH_QUERY } from './mobile-onboarding-contract-health-query';

describe('MOBILE_ONBOARDING_CONTRACT_HEALTH_QUERY', () => {
  it('uses the live-supported UTC conversion and eight complete calendar days', () => {
    expect(MOBILE_ONBOARDING_CONTRACT_HEALTH_QUERY).toContain(
      "toDate(toTimeZone(timestamp, 'UTC'))"
    );
    expect(MOBILE_ONBOARDING_CONTRACT_HEALTH_QUERY).toContain(
      "toStartOfDay(toTimeZone(now(), 'UTC')) - INTERVAL 8 DAY"
    );
    expect(MOBILE_ONBOARDING_CONTRACT_HEALTH_QUERY).toContain(
      "timestamp < toStartOfDay(toTimeZone(now(), 'UTC'))"
    );
    expect(MOBILE_ONBOARDING_CONTRACT_HEALTH_QUERY).not.toContain(
      "toDate(timestamp, 'UTC')"
    );
  });

  it('groups only versioned invocations and the daily telemetry canary', () => {
    expect(MOBILE_ONBOARDING_CONTRACT_HEALTH_QUERY).toContain(`event IN (
    'mobile_onboarding_contract_invoked',
    'mobile_onboarding_contract_telemetry_canary'
  )`);
    expect(MOBILE_ONBOARDING_CONTRACT_HEALTH_QUERY).toContain(
      "event = 'mobile_onboarding_contract_invoked'"
    );
    expect(MOBILE_ONBOARDING_CONTRACT_HEALTH_QUERY).toContain(
      'toString(properties.contract)'
    );
    expect(MOBILE_ONBOARDING_CONTRACT_HEALTH_QUERY).toContain("'canary'");
    expect(MOBILE_ONBOARDING_CONTRACT_HEALTH_QUERY).toContain(
      'count() AS total'
    );
    expect(MOBILE_ONBOARDING_CONTRACT_HEALTH_QUERY).toContain(
      'GROUP BY day, event, contract'
    );
  });
});
