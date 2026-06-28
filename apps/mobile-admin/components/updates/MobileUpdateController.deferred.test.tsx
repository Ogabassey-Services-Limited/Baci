import '@testing-library/jest-dom/vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileUpdateController } from './MobileUpdateController';
import type { MobileUpdatePromptResult } from './mobile-update-check';

type AppStateListener = (state: string) => void;

const mockResolveMobileUpdatePrompt =
  vi.fn<(...args: unknown[]) => Promise<MobileUpdatePromptResult>>();
const mockOpenUrl = vi.fn<(url: string) => Promise<void>>();
const mockAppStateListeners = new Set<AppStateListener>();
let mockPathname = '/orders';

vi.mock('expo-application', () => ({
  nativeApplicationVersion: '2.0.0',
  nativeBuildVersion: '42',
}));

vi.mock('expo-router', () => ({
  usePathname: () => mockPathname,
}));

vi.mock('@/lib/api-base-url', () => ({
  BASE_URL: 'https://usebaci.com',
}));

vi.mock('@/config/runtime-platform', () => ({
  getRuntimePlatform: () => 'ios',
}));

vi.mock('./mobile-update-check', () => ({
  resolveMobileUpdatePrompt: (
    ...args: Parameters<typeof mockResolveMobileUpdatePrompt>
  ) => mockResolveMobileUpdatePrompt(...args),
}));

vi.mock('./MobileUpdateModal', () => ({
  MobileUpdateModal: ({
    prompt,
    visible,
  }: {
    prompt: null | { kind: string; message: string };
    visible: boolean;
  }) => (visible && prompt ? <span>{`prompt:${prompt.kind}`}</span> : null),
}));

vi.mock('react-native', () => ({
  AppState: {
    addEventListener: (_event: string, listener: AppStateListener) => {
      mockAppStateListeners.add(listener);
      return {
        remove: () => {
          mockAppStateListeners.delete(listener);
        },
      };
    },
  },
  Linking: {
    openURL: (url: string) => mockOpenUrl(url),
  },
}));

function ControllerHarness(): ReactNode {
  return <MobileUpdateController />;
}

const STORE_URL = 'https://apps.apple.com/app/id6757810806';

describe('MobileUpdateController deferred route handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppStateListeners.clear();
    mockPathname = '/orders';
    mockOpenUrl.mockResolvedValue(undefined);
    mockResolveMobileUpdatePrompt.mockResolvedValue({ kind: 'none' });
  });

  afterEach(() => {
    mockAppStateListeners.clear();
  });

  it('clears a visible prompt when navigation enters a deferred route', async () => {
    mockResolveMobileUpdatePrompt
      .mockResolvedValueOnce({
        kind: 'native-recommended',
        message: 'A newer version is available.',
        storeUrl: STORE_URL,
      })
      .mockResolvedValueOnce({ kind: 'none' });

    const view = render(<ControllerHarness />);

    expect(
      await screen.findByText('prompt:native-recommended')
    ).toBeInTheDocument();

    mockPathname = '/login';
    view.rerender(<ControllerHarness />);

    await waitFor(() => {
      expect(screen.queryByText('prompt:native-recommended')).toBeNull();
    });

    mockPathname = '/orders';
    view.rerender(<ControllerHarness />);

    await waitFor(() => {
      expect(mockResolveMobileUpdatePrompt).toHaveBeenCalledTimes(2);
    });
  });

  it('drops a late async prompt when the latest route is deferred', async () => {
    let resolveCheck: ((result: MobileUpdatePromptResult) => void) | undefined;
    mockResolveMobileUpdatePrompt.mockImplementationOnce(
      () =>
        new Promise<MobileUpdatePromptResult>((resolve) => {
          resolveCheck = resolve;
        })
    );

    const view = render(<ControllerHarness />);

    await waitFor(() => {
      expect(mockResolveMobileUpdatePrompt).toHaveBeenCalledTimes(1);
    });

    mockPathname = '/scan';
    view.rerender(<ControllerHarness />);

    act(() => {
      resolveCheck?.({
        kind: 'native-required',
        message: 'Install the latest app.',
        storeUrl: STORE_URL,
      });
    });

    await waitFor(() => {
      expect(screen.queryByText('prompt:native-required')).toBeNull();
    });
  });
});
