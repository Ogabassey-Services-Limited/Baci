import { describe, expect, it } from 'vitest';
import {
  getAllowedNextRepairStatuses,
  getRepairStatusColors,
  getRepairStatusLabel,
  isTerminalRepairStatus,
} from './repair-status';

// Minimal theme color fixture — mirrors the fields these helpers read from
// `ThemeColors` (apps/mobile-admin/constants/theme.ts) without importing the
// full light/dark palettes.
const colors = {
  border: '#E2E8F0',
  error: '#EF4444',
  errorLight: 'rgba(239, 68, 68, 0.15)',
  info: '#3B82F6',
  infoLight: 'rgba(59, 130, 246, 0.15)',
  primary: '#4A90D9',
  primaryLight: 'rgba(74, 144, 217, 0.15)',
  success: '#22C55E',
  successLight: 'rgba(34, 197, 94, 0.15)',
  textMuted: '#6B7280',
  textSecondary: '#9CA3AF',
  warning: '#F59E0B',
  warningLight: 'rgba(245, 158, 11, 0.15)',
} as Parameters<typeof getRepairStatusColors>[1];

describe('getRepairStatusLabel', () => {
  it('returns the human label for every known status', () => {
    expect(getRepairStatusLabel('pending')).toBe('Pending');
    expect(getRepairStatusLabel('confirmed')).toBe('Confirmed');
    expect(getRepairStatusLabel('in_progress')).toBe('In progress');
    expect(getRepairStatusLabel('completed')).toBe('Completed');
    expect(getRepairStatusLabel('cancelled')).toBe('Cancelled');
    expect(getRepairStatusLabel('rejected')).toBe('Rejected');
  });
});

describe('getAllowedNextRepairStatuses', () => {
  it('mirrors the web lifecycle: pending can advance to in-flight or terminal states', () => {
    expect(getAllowedNextRepairStatuses('pending')).toEqual([
      'confirmed',
      'in_progress',
      'rejected',
      'cancelled',
    ]);
  });

  it('mirrors the web lifecycle: confirmed can advance to in_progress/completed/cancelled', () => {
    expect(getAllowedNextRepairStatuses('confirmed')).toEqual([
      'in_progress',
      'completed',
      'cancelled',
    ]);
  });

  it('mirrors the web lifecycle: in_progress can only complete or cancel', () => {
    expect(getAllowedNextRepairStatuses('in_progress')).toEqual([
      'completed',
      'cancelled',
    ]);
  });

  it('returns no further transitions for terminal statuses', () => {
    expect(getAllowedNextRepairStatuses('completed')).toEqual([]);
    expect(getAllowedNextRepairStatuses('cancelled')).toEqual([]);
    expect(getAllowedNextRepairStatuses('rejected')).toEqual([]);
  });
});

describe('isTerminalRepairStatus', () => {
  it('flags completed, cancelled, and rejected as terminal', () => {
    expect(isTerminalRepairStatus('completed')).toBe(true);
    expect(isTerminalRepairStatus('cancelled')).toBe(true);
    expect(isTerminalRepairStatus('rejected')).toBe(true);
  });

  it('flags pending, confirmed, and in_progress as non-terminal', () => {
    expect(isTerminalRepairStatus('pending')).toBe(false);
    expect(isTerminalRepairStatus('confirmed')).toBe(false);
    expect(isTerminalRepairStatus('in_progress')).toBe(false);
  });
});

describe('getRepairStatusColors', () => {
  it('maps each status to its themed foreground/background pair', () => {
    expect(getRepairStatusColors('pending', colors)).toEqual({
      background: colors.warningLight,
      text: colors.warning,
    });
    expect(getRepairStatusColors('confirmed', colors)).toEqual({
      background: colors.infoLight,
      text: colors.info,
    });
    expect(getRepairStatusColors('in_progress', colors)).toEqual({
      background: colors.primaryLight,
      text: colors.primary,
    });
    expect(getRepairStatusColors('completed', colors)).toEqual({
      background: colors.successLight,
      text: colors.success,
    });
    expect(getRepairStatusColors('cancelled', colors)).toEqual({
      background: colors.border,
      text: colors.textMuted,
    });
    expect(getRepairStatusColors('rejected', colors)).toEqual({
      background: colors.errorLight,
      text: colors.error,
    });
  });
});
