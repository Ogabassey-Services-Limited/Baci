import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBlogAutoSave } from './use-blog-auto-save';

describe('useBlogAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns clearSavedData, hasSavedData, getSavedData', () => {
    const { result } = renderHook(() =>
      useBlogAutoSave({ storageKey: 'test-key', data: { title: 'Hello' } })
    );
    expect(result.current.clearSavedData).toBeTypeOf('function');
    expect(result.current.hasSavedData).toBeTypeOf('function');
    expect(result.current.getSavedData).toBeTypeOf('function');
  });

  it('does not save on initial mount', () => {
    renderHook(() =>
      useBlogAutoSave({ storageKey: 'test-key', data: { title: 'Draft' } })
    );
    vi.advanceTimersByTime(3000);
    expect(localStorage.getItem('test-key')).toBeNull();
  });

  it('saves data after debounce on data change', () => {
    const { rerender } = renderHook(
      ({ data }) => useBlogAutoSave({ storageKey: 'test-key', data }),
      { initialProps: { data: { title: 'First' } } }
    );

    rerender({ data: { title: 'Updated' } });
    vi.advanceTimersByTime(2500);

    const stored = localStorage.getItem('test-key');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored as string);
    expect(parsed.data.title).toBe('Updated');
  });

  it('does not save when disabled', () => {
    const { rerender } = renderHook(
      ({ data }) =>
        useBlogAutoSave({ storageKey: 'test-key', data, enabled: false }),
      { initialProps: { data: { title: 'First' } } }
    );

    rerender({ data: { title: 'Updated' } });
    vi.advanceTimersByTime(3000);
    expect(localStorage.getItem('test-key')).toBeNull();
  });

  it('hasSavedData returns true for recent data', () => {
    const saved = {
      data: { title: 'Test' },
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem('test-key', JSON.stringify(saved));

    const { result } = renderHook(() =>
      useBlogAutoSave({ storageKey: 'test-key', data: { title: 'New' } })
    );
    expect(result.current.hasSavedData()).toBe(true);
  });

  it('hasSavedData returns false for expired data (>24h)', () => {
    const oldDate = new Date();
    oldDate.setHours(oldDate.getHours() - 25);
    const saved = { data: { title: 'Old' }, savedAt: oldDate.toISOString() };
    localStorage.setItem('test-key', JSON.stringify(saved));

    const { result } = renderHook(() =>
      useBlogAutoSave({ storageKey: 'test-key', data: {} })
    );
    expect(result.current.hasSavedData()).toBe(false);
  });

  it('clearSavedData removes from localStorage', () => {
    localStorage.setItem(
      'test-key',
      JSON.stringify({ data: {}, savedAt: new Date().toISOString() })
    );
    const { result } = renderHook(() =>
      useBlogAutoSave({ storageKey: 'test-key', data: {} })
    );
    result.current.clearSavedData();
    expect(localStorage.getItem('test-key')).toBeNull();
  });

  it('getSavedData returns stored data', () => {
    const now = new Date().toISOString();
    localStorage.setItem(
      'test-key',
      JSON.stringify({ data: { title: 'Saved' }, savedAt: now })
    );
    const { result } = renderHook(() =>
      useBlogAutoSave({ storageKey: 'test-key', data: {} })
    );
    const saved = result.current.getSavedData();
    expect(saved?.data).toEqual({ title: 'Saved' });
  });
});
