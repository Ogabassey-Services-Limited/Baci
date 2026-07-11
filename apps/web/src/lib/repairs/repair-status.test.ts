import { describe, expect, it } from 'vitest';
import {
  canTransitionRepairStatus,
  getAllowedNextRepairStatuses,
  getRepairStatusColorClasses,
  getRepairStatusLabel,
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

describe('canTransitionRepairStatus', () => {
  it('allows valid forward transitions', () => {
    expect(canTransitionRepairStatus('pending', 'confirmed')).toBe(true);
    expect(canTransitionRepairStatus('confirmed', 'in_progress')).toBe(true);
    expect(canTransitionRepairStatus('in_progress', 'completed')).toBe(true);
  });

  it('allows cancelling/rejecting an in-flight booking', () => {
    expect(canTransitionRepairStatus('pending', 'rejected')).toBe(true);
    expect(canTransitionRepairStatus('in_progress', 'cancelled')).toBe(true);
  });

  it('rejects transitions out of a terminal state', () => {
    expect(canTransitionRepairStatus('completed', 'pending')).toBe(false);
    expect(canTransitionRepairStatus('cancelled', 'in_progress')).toBe(false);
    expect(canTransitionRepairStatus('rejected', 'confirmed')).toBe(false);
  });

  it('rejects invalid or skip-ahead transitions', () => {
    expect(canTransitionRepairStatus('pending', 'completed')).toBe(false);
    expect(canTransitionRepairStatus('confirmed', 'rejected')).toBe(false);
    expect(canTransitionRepairStatus('pending', 'pending')).toBe(false);
  });
});

describe('getRepairStatusLabel', () => {
  it('returns the human label for every known status', () => {
    expect(getRepairStatusLabel('pending')).toBe('Pending');
    expect(getRepairStatusLabel('in_progress')).toBe('In progress');
    expect(getRepairStatusLabel('completed')).toBe('Completed');
    expect(getRepairStatusLabel('rejected')).toBe('Rejected');
  });

  it('echoes back an unknown value unchanged', () => {
    expect(getRepairStatusLabel('mystery')).toBe('mystery');
    expect(getRepairStatusLabel('')).toBe('');
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
