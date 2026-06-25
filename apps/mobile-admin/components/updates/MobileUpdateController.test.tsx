import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileUpdateController } from './MobileUpdateController';
import type { MobileUpdatePromptResult } from './mobile-update-check';
import { requestMobileUpdateCheck } from './mobile-update-events';

type AppStateListener = (state: string) => void;

const mockResolveMobileUpdatePrompt =
  vi.fn<(...args: unknown[]) => Promise<MobileUpdatePromptResult>>();
const mockOpenUrl = vi.fn<(url: string) => Promise<void>>();
const mockAppStateListeners = new Set<AppStateListener>();
let mockPlatformOS = 'ios';
let mockPathname = '/';

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

vi.mock('./mobile-update-check', () => ({
  resolveMobileUpdatePrompt: (
    ...args: Parameters<typeof mockResolveMobileUpdatePrompt>
  ) => mockResolveMobileUpdatePrompt(...args),
}));

vi.mock('./MobileUpdateModal', () => ({
  MobileUpdateModal: ({
    onAccept,
    onDismiss,
    prompt,
    visible,
  }: {
    onAccept: () => void;
    onDismiss: () => void;
    prompt: null | { kind: string; message: string };
    visible: boolean;
  }) =>
    visible && prompt ? (
      <div>
        <span>{`prompt:${prompt.kind}`}</span>
        <button aria-label="accept update" onClick={onAccept} type="button">
          accept
        </button>
        <button aria-label="dismiss update" onClick={onDismiss} type="button">
          dismiss
        </button>
      </div>
    ) : null,
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
  get Platform() {
    return { OS: mockPlatformOS };
  },
}));

function ControllerHarness(): ReactNode {
  return <MobileUpdateController />;
}

const STORE_URL = 'https://apps.apple.com/app/id6757810806';

describe('MobileUpdateController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppStateListeners.clear();
    mockPathname = '/';
    mockPlatformOS = 'ios';
    mockOpenUrl.mockResolvedValue(undefined);
    mockResolveMobileUpdatePrompt.mockResolvedValue({ kind: 'none' });
  });

  afterEach(() => {
    mockAppStateListeners.clear();
  });

  it('checks for updates on mount with native-only inputs (no OTA)', async () => {
    mockResolveMobileUpdatePrompt.mockResolvedValue({
      kind: 'native-recommended',
      message: 'A newer version is available.',
      storeUrl: STORE_URL,
    });

    render(<ControllerHarness />);

    expect(
      await screen.findByText('prompt:native-recommended')
    ).toBeInTheDocument();
    expect(mockResolveMobileUpdatePrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        apiBaseUrl: 'https://usebaci.com',
        buildNumber: '42',
        channel: 'production',
        isOtaEnabled: false,
        nativeVersion: '2.0.0',
        pathname: '/',
        platform: 'ios',
        runtimeVersion: '2.0.0',
      })
    );
  });

  it('reruns a deferred check when navigation returns to a safe route', async () => {
    mockPathname = '/(auth)/login';
    mockResolveMobileUpdatePrompt
      .mockResolvedValueOnce({ kind: 'deferred' })
      .mockResolvedValueOnce({
        kind: 'native-recommended',
        message: 'A newer version is available.',
        storeUrl: STORE_URL,
      });

    const view = render(<ControllerHarness />);

    await waitFor(() => {
      expect(mockResolveMobileUpdatePrompt).toHaveBeenCalledTimes(1);
    });

    mockPathname = '/';
    view.rerender(<ControllerHarness />);

    expect(
      await screen.findByText('prompt:native-recommended')
    ).toBeInTheDocument();
    expect(mockResolveMobileUpdatePrompt).toHaveBeenCalledTimes(2);
  });

  it('runs checks requested by foreground and push events', async () => {
    mockResolveMobileUpdatePrompt
      .mockResolvedValueOnce({ kind: 'none' })
      .mockResolvedValueOnce({ kind: 'none' })
      .mockResolvedValueOnce({
        kind: 'native-recommended',
        message: 'A newer version is available.',
        storeUrl: STORE_URL,
      });

    render(<ControllerHarness />);

    await waitFor(() => {
      expect(mockResolveMobileUpdatePrompt).toHaveBeenCalledTimes(1);
    });

    for (const listener of mockAppStateListeners) {
      listener('active');
    }

    await waitFor(() => {
      expect(mockResolveMobileUpdatePrompt).toHaveBeenCalledTimes(2);
    });

    requestMobileUpdateCheck('push-notification');

    expect(
      await screen.findByText('prompt:native-recommended')
    ).toBeInTheDocument();
    expect(mockResolveMobileUpdatePrompt).toHaveBeenCalledTimes(3);
  });

  it('opens the app store for accepted native updates', async () => {
    mockResolveMobileUpdatePrompt.mockResolvedValue({
      kind: 'native-required',
      message: 'Install the latest app.',
      storeUrl: STORE_URL,
    });

    render(<ControllerHarness />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'accept update' })
    );

    await waitFor(() => {
      expect(mockOpenUrl).toHaveBeenCalledWith(STORE_URL);
    });
  });

  it('dismisses optional prompts', async () => {
    mockResolveMobileUpdatePrompt.mockResolvedValue({
      kind: 'native-recommended',
      message: 'Install a newer app.',
      storeUrl: STORE_URL,
    });

    render(<ControllerHarness />);

    expect(
      await screen.findByText('prompt:native-recommended')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'dismiss update' }));

    expect(screen.queryByText('prompt:native-recommended')).toBeNull();
  });

  it('keeps required native prompts visible when dismiss is requested', async () => {
    mockResolveMobileUpdatePrompt.mockResolvedValue({
      kind: 'native-required',
      message: 'Install the latest app.',
      storeUrl: STORE_URL,
    });

    render(<ControllerHarness />);

    expect(
      await screen.findByText('prompt:native-required')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'dismiss update' }));

    expect(screen.getByText('prompt:native-required')).toBeInTheDocument();
  });

  it('clears optional prompts when opening the store fails', async () => {
    mockOpenUrl.mockRejectedValue(new Error('cannot open url'));
    mockResolveMobileUpdatePrompt.mockResolvedValue({
      kind: 'native-recommended',
      message: 'A newer version is available.',
      storeUrl: STORE_URL,
    });

    render(<ControllerHarness />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'accept update' })
    );

    await waitFor(() => {
      expect(screen.queryByText('prompt:native-recommended')).toBeNull();
    });
  });
});
