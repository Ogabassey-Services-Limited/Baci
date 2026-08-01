import { describe, expect, it } from 'vitest';
import {
  createMobileReadinessPayload,
  createReadinessPayload,
} from './store-build-status-card.test-helpers';

describe('store build status card test helpers', () => {
  it('creates web and mobile readiness payloads', () => {
    expect(createReadinessPayload()).toEqual(expect.any(Object));
    expect(createMobileReadinessPayload()).toEqual(expect.any(Object));
  });
});
