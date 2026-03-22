import { describe, expect, it } from 'vitest';
import {
  isImportJobActive,
  isImportJobTerminal,
} from '@/lib/import-jobs/import-job-status';

describe('import-job-status helpers', () => {
  it('detects every active status', () => {
    expect(isImportJobActive('uploaded')).toBe(true);
    expect(isImportJobActive('validating')).toBe(true);
    expect(isImportJobActive('commit_queued')).toBe(true);
    expect(isImportJobActive('committing')).toBe(true);
    expect(isImportJobActive('notify_queued')).toBe(true);
    expect(isImportJobActive('notifying')).toBe(true);
    expect(isImportJobActive('preview_ready')).toBe(false);
    expect(isImportJobActive('committed')).toBe(false);
    expect(isImportJobActive('completed')).toBe(false);
    expect(isImportJobActive('failed')).toBe(false);
  });

  it('detects every terminal status', () => {
    expect(isImportJobTerminal('uploaded')).toBe(false);
    expect(isImportJobTerminal('validating')).toBe(false);
    expect(isImportJobTerminal('commit_queued')).toBe(false);
    expect(isImportJobTerminal('committing')).toBe(false);
    expect(isImportJobTerminal('notify_queued')).toBe(false);
    expect(isImportJobTerminal('notifying')).toBe(false);
    expect(isImportJobTerminal('preview_ready')).toBe(true);
    expect(isImportJobTerminal('committed')).toBe(true);
    expect(isImportJobTerminal('completed')).toBe(true);
    expect(isImportJobTerminal('failed')).toBe(true);
  });

  it('returns false for invalid or empty status values', () => {
    expect(isImportJobActive('')).toBe(false);
    expect(isImportJobActive('random')).toBe(false);
    expect(isImportJobActive(String(null))).toBe(false);
    expect(isImportJobActive(String(undefined))).toBe(false);
    expect(isImportJobTerminal('')).toBe(false);
    expect(isImportJobTerminal('random')).toBe(false);
    expect(isImportJobTerminal(String(null))).toBe(false);
    expect(isImportJobTerminal(String(undefined))).toBe(false);
  });
});
