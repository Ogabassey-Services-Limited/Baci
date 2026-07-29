import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hookMocks = vi.hoisted(() => ({
  useReactQueryAppFocus: vi.fn(),
}));

vi.mock('@/hooks/useReactQueryAppFocus', () => ({
  useReactQueryAppFocus: hookMocks.useReactQueryAppFocus,
}));

vi.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    clearAll: vi.fn(),
    getString: vi.fn(),
    remove: vi.fn(),
    set: vi.fn(),
  }),
}));

import { QueryProvider } from './QueryProvider';

describe('QueryProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invokes the React Query app-focus hook when the provider renders', () => {
    // Act
    render(
      <QueryProvider>
        <span>Ready</span>
      </QueryProvider>
    );

    // Assert
    expect(screen.getByText('Ready')).toBeTruthy();
    expect(hookMocks.useReactQueryAppFocus).toHaveBeenCalledOnce();
  });
});
