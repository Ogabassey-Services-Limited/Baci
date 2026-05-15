import { describe, expect, it } from 'vitest';
import {
  getXiaomiStatuses,
  hasXiaomiLockIssue,
  hasXiaomiLostIssue,
} from './sickw-xiaomi-status';

describe('Xiaomi IMEI status helpers', () => {
  it('extracts lock and lost statuses from provider field aliases', () => {
    expect(
      getXiaomiStatuses(
        {
          'mi account status': 'Locked',
          'lost mode': 'Clean',
        },
        'Redmi Note 13'
      )
    ).toEqual({
      miLockStatus: 'Locked',
      miLostStatus: 'Clean',
    });
  });

  it('classifies Xiaomi lock status without treating unlocked as locked', () => {
    expect(hasXiaomiLockIssue('Locked')).toBe(true);
    expect(hasXiaomiLockIssue(' Locked ')).toBe(true);
    expect(hasXiaomiLockIssue('LOCKED')).toBe(true);
    expect(hasXiaomiLockIssue('locked')).toBe(true);
    expect(hasXiaomiLockIssue('Unlocked')).toBe(false);
    expect(hasXiaomiLockIssue('Not locked')).toBe(false);
    expect(hasXiaomiLockIssue('Off')).toBe(false);
    expect(hasXiaomiLockIssue('Clean')).toBe(false);
    expect(hasXiaomiLockIssue('Locked but unlocked')).toBe(false);
    expect(hasXiaomiLockIssue('Based on provider data')).toBe(false);
    expect(hasXiaomiLockIssue('On')).toBe(true);
    expect(hasXiaomiLockIssue(' On ')).toBe(true);
    expect(hasXiaomiLockIssue('')).toBe(false);
  });

  it('classifies Xiaomi lost status without treating clean as lost', () => {
    expect(hasXiaomiLostIssue('Lost')).toBe(true);
    expect(hasXiaomiLostIssue('STOLEN')).toBe(true);
    expect(hasXiaomiLostIssue('Lost and found')).toBe(true);
    expect(hasXiaomiLostIssue('Clean')).toBe(false);
    expect(hasXiaomiLostIssue('Not lost')).toBe(false);
    expect(hasXiaomiLostIssue('Off')).toBe(false);
    expect(hasXiaomiLostIssue('')).toBe(false);
  });

  it('uses the first supported provider alias for Xiaomi statuses', () => {
    expect(
      getXiaomiStatuses({
        'lost status': 'Lost fallback',
        'mi lock': 'Lock first',
        'mi lock status': 'Lock second',
        'mi lost': 'Lost first',
      })
    ).toEqual({
      miLockStatus: 'Lock first',
      miLostStatus: 'Lost first',
    });
  });

  it('ignores generic lost aliases outside Xiaomi context', () => {
    expect(
      getXiaomiStatuses(
        {
          'lost status': 'Lost',
        },
        'iPhone 15'
      )
    ).toEqual({
      miLockStatus: '',
      miLostStatus: '',
    });
  });
});
