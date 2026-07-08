import { describe, expect, it } from 'vitest';
import {
  getAllowedNextRepairStatuses,
  getRepairStatusColorClasses,
  isRepairStatus,
  isTerminalRepairStatus,
  REPAIR_STATUS_LABELS,
  REPAIR_STATUS_TIMELINE,
} from './repair-status';

describe('isRepairStatus', () => {
  it('accepts every enum value', () => {
    for (const status of [
      'pending',
      'confirmed',
      'in_progress',
      'completed',
      'cancelled',
      'rejected',
    ]) {
      expect(isRepairStatus(status)).toBe(true);
    }
  });

  it('rejects unknown values', () => {
    expect(isRepairStatus('shipped')).toBe(false);
    expect(isRepairStatus('')).toBe(false);
    expect(isRepairStatus(42)).toBe(false);
  });
});

describe('getAllowedNextRepairStatuses', () => {
  it('advances pending toward confirmed/rejected/cancelled', () => {
    expect(getAllowedNextRepairStatuses('pending')).toEqual([
      'confirmed',
      'in_progress',
      'rejected',
      'cancelled',
    ]);
  });

  it('lets confirmed move to in_progress or cancel', () => {
    expect(getAllowedNextRepairStatuses('confirmed')).toEqual([
      'in_progress',
      'completed',
      'cancelled',
    ]);
  });

  it('returns no transitions for terminal statuses', () => {
    expect(getAllowedNextRepairStatuses('completed')).toEqual([]);
    expect(getAllowedNextRepairStatuses('cancelled')).toEqual([]);
    expect(getAllowedNextRepairStatuses('rejected')).toEqual([]);
  });
});

describe('isTerminalRepairStatus', () => {
  it('flags completed/cancelled/rejected as terminal', () => {
    expect(isTerminalRepairStatus('completed')).toBe(true);
    expect(isTerminalRepairStatus('cancelled')).toBe(true);
    expect(isTerminalRepairStatus('rejected')).toBe(true);
  });

  it('flags in-flight statuses as non-terminal', () => {
    expect(isTerminalRepairStatus('pending')).toBe(false);
    expect(isTerminalRepairStatus('in_progress')).toBe(false);
  });
});

describe('labels + timeline', () => {
  it('has a human label for every status', () => {
    expect(REPAIR_STATUS_LABELS.in_progress).toBe('In progress');
    expect(REPAIR_STATUS_LABELS.pending).toBe('Pending');
  });

  it('exposes the happy-path timeline order', () => {
    expect(REPAIR_STATUS_TIMELINE).toEqual([
      'pending',
      'confirmed',
      'in_progress',
      'completed',
    ]);
  });
});

describe('getRepairStatusColorClasses', () => {
  it('returns distinct classes for completed vs rejected', () => {
    expect(getRepairStatusColorClasses('completed')).toContain('green');
    expect(getRepairStatusColorClasses('rejected')).toContain('red');
  });

  it('falls back to neutral classes for unknown values', () => {
    expect(getRepairStatusColorClasses('mystery')).toContain('gray');
  });
});
