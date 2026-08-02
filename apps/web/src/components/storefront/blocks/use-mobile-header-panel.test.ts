import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useMobileHeaderPanel } from './use-mobile-header-panel';

describe('useMobileHeaderPanel', () => {
  it('keeps menu and search panel modes mutually exclusive', () => {
    const { result } = renderHook(() => useMobileHeaderPanel());

    act(() => result.current.openMenu());
    expect(result.current.mode).toBe('menu');

    act(() => result.current.openSearch());
    expect(result.current.mode).toBe('search');

    act(() => result.current.close());
    expect(result.current.mode).toBe('closed');
  });
});
