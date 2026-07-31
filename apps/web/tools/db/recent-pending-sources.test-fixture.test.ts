import { describe, expect, it } from 'vitest';
import { RECENT_PENDING_SOURCES } from './recent-pending-sources.test-fixture';

describe('recent pending sources fixture', () => {
  it('contains the pending migration source set used by replay tests', () => {
    expect(RECENT_PENDING_SOURCES.length).toBeGreaterThan(0);
  });
});
