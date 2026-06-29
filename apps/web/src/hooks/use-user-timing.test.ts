import { renderHook } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUserTiming } from './use-user-timing';

// Mock useId to return a predictable component ID
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof React>();
  return {
    ...actual,
    useId: () => 'mock-id-123',
  };
});

describe('useUserTiming', () => {
  const originalPerformance = global.performance;

  beforeEach(() => {
    // Reset global performance mocks before each test
    global.performance = {
      ...originalPerformance,
      mark: vi.fn(),
      measure: vi.fn(),
      clearMarks: vi.fn(),
    } as unknown as Performance;
  });

  it('marks performance on mount and measures/clears on unmount', () => {
    const hookName = 'test-component';
    const { unmount } = renderHook(() => useUserTiming(hookName));

    const expectedStartMark = `${hookName}-mock-id-123-start`;
    const expectedEndMark = `${hookName}-mock-id-123-end`;

    // Should mark start on mount
    expect(global.performance.mark).toHaveBeenCalledWith(expectedStartMark);
    expect(global.performance.measure).not.toHaveBeenCalled();
    expect(global.performance.clearMarks).not.toHaveBeenCalled();

    // Clear initial call for easier unmount assertion
    vi.mocked(global.performance.mark).mockClear();

    unmount();

    // Should mark end on unmount
    expect(global.performance.mark).toHaveBeenCalledWith(expectedEndMark);

    // Should measure duration
    expect(global.performance.measure).toHaveBeenCalledWith(
      hookName,
      expectedStartMark,
      expectedEndMark
    );

    // Should clear marks to avoid memory leaks
    expect(global.performance.clearMarks).toHaveBeenCalledWith(
      expectedStartMark
    );
    expect(global.performance.clearMarks).toHaveBeenCalledWith(expectedEndMark);
  });

  it('does nothing when disabled', () => {
    const { unmount } = renderHook(() =>
      useUserTiming('test-component', false)
    );

    expect(global.performance.mark).not.toHaveBeenCalled();

    unmount();

    expect(global.performance.mark).not.toHaveBeenCalled();
    expect(global.performance.measure).not.toHaveBeenCalled();
    expect(global.performance.clearMarks).not.toHaveBeenCalled();
  });

  it('handles errors gracefully when performance.measure throws during unmount', () => {
    // Mock measure to throw an error (e.g. if start mark was missing)
    vi.mocked(global.performance.measure).mockImplementation(() => {
      throw new Error('Marks not found');
    });

    const hookName = 'error-test-component';
    const { unmount } = renderHook(() => useUserTiming(hookName));

    const expectedStartMark = `${hookName}-mock-id-123-start`;
    const expectedEndMark = `${hookName}-mock-id-123-end`;

    // Should not throw and should still clear marks despite the error
    expect(() => unmount()).not.toThrow();

    expect(global.performance.measure).toHaveBeenCalled();
    expect(global.performance.clearMarks).toHaveBeenCalledWith(
      expectedStartMark
    );
    expect(global.performance.clearMarks).toHaveBeenCalledWith(expectedEndMark);
  });

  it('bails out gracefully if performance API is undefined', () => {
    // @ts-expect-error - simulating environment without performance API
    delete global.performance;

    const { unmount } = renderHook(() => useUserTiming('no-perf-test'));

    expect(() => unmount()).not.toThrow();

    // Restore performance for subsequent tests
    global.performance = originalPerformance;
  });
});
