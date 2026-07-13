import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import {
  AppState,
  type AppStateStatus,
  Linking,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { MobileUpdateController } from './MobileUpdateController';
import type { MobileUpdatePromptResult } from './mobile-update-check';
import { requestMobileUpdateCheck } from './mobile-update-events';

const mockResolveMobileUpdatePrompt =
  jest.fn<(...args: unknown[]) => Promise<MobileUpdatePromptResult>>();
const mockFetchUpdateAsync = jest.fn<() => Promise<void>>();
const mockReloadAsync = jest.fn<() => Promise<void>>();
const mockOpenUrl = jest.fn<(url: string) => Promise<void>>();
const mockAppStateListeners = new Set<(state: AppStateStatus) => void>();
const MockPressable = Pressable;
const MockText = Text;
const MockView = View;
const originalPlatformOS = Platform.OS;
let mockPathname = '/';

jest.mock('expo-application', () => ({
  nativeApplicationVersion: '2.0.0',
  nativeBuildVersion: '42',
}));

jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
}));

jest.mock('expo-updates', () => ({
  channel: 'preview',
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: () => mockFetchUpdateAsync(),
  isEnabled: true,
  reloadAsync: () => mockReloadAsync(),
  runtimeVersion: '2.0.0',
}));

jest.mock('@/env', () => ({
  EXPO_PUBLIC_API_URL: 'https://usebaci.com',
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    warn: jest.fn(),
  }),
}));

jest.mock('./mobile-update-check', () => ({
  resolveMobileUpdatePrompt: (
    ...args: Parameters<typeof mockResolveMobileUpdatePrompt>
  ) => mockResolveMobileUpdatePrompt(...args),
}));

jest.mock('./MobileUpdateModal', () => ({
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
      <MockView>
        <MockText>{`prompt:${prompt.kind}`}</MockText>
        <MockPressable
          accessibilityLabel="accept update"
          accessibilityRole="button"
          onPress={onAccept}
        >
          <MockText>accept</MockText>
        </MockPressable>
        <MockPressable
          accessibilityLabel="dismiss update"
          accessibilityRole="button"
          onPress={onDismiss}
        >
          <MockText>dismiss</MockText>
        </MockPressable>
      </MockView>
    ) : null,
}));

function setPlatformOS(value: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value,
  });
}

describe('MobileUpdateController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppStateListeners.clear();
    mockPathname = '/';
    setPlatformOS('ios');
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation(
        (
          _event: Parameters<typeof AppState.addEventListener>[0],
          listener: Parameters<typeof AppState.addEventListener>[1]
        ) => {
          mockAppStateListeners.add(listener);
          return {
            remove: () => {
              mockAppStateListeners.delete(listener);
            },
          } as ReturnType<typeof AppState.addEventListener>;
        }
      );
    jest
      .spyOn(Linking, 'openURL')
      .mockImplementation((url) => mockOpenUrl(url));
    mockFetchUpdateAsync.mockResolvedValue(undefined);
    mockReloadAsync.mockResolvedValue(undefined);
    mockOpenUrl.mockResolvedValue(undefined);
    mockResolveMobileUpdatePrompt.mockResolvedValue({ kind: 'none' });
  });

  afterEach(() => {
    mockAppStateListeners.clear();
    setPlatformOS(originalPlatformOS);
    jest.restoreAllMocks();
  });

  it('checks for updates on mount and renders an available OTA prompt', async () => {
    mockResolveMobileUpdatePrompt.mockResolvedValue({
      kind: 'ota-available',
      message: 'A faster version is ready.',
    });

    render(<MobileUpdateController />);

    expect(await screen.findByText('prompt:ota-available')).toBeTruthy();
    expect(mockResolveMobileUpdatePrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        apiBaseUrl: 'https://usebaci.com',
        buildNumber: '42',
        channel: 'preview',
        nativeVersion: '2.0.0',
        pathname: '/',
        platform: 'ios',
        runtimeVersion: '2.0.0',
      })
    );
  });

  it('reruns a deferred check when navigation returns to a safe route', async () => {
    mockPathname = '/checkout';
    mockResolveMobileUpdatePrompt
      .mockResolvedValueOnce({ kind: 'deferred' })
      .mockResolvedValueOnce({
        kind: 'ota-available',
        message: 'A faster version is ready.',
      });
    const view = render(<MobileUpdateController />);

    await waitFor(() => {
      expect(mockResolveMobileUpdatePrompt).toHaveBeenCalledTimes(1);
    });

    mockPathname = '/';
    view.rerender(<MobileUpdateController />);

    expect(await screen.findByText('prompt:ota-available')).toBeTruthy();
    expect(mockResolveMobileUpdatePrompt).toHaveBeenCalledTimes(2);
  });

  it('runs checks requested by foreground and push events', async () => {
    mockResolveMobileUpdatePrompt
      .mockResolvedValueOnce({ kind: 'none' })
      .mockResolvedValueOnce({ kind: 'none' })
      .mockResolvedValueOnce({
        kind: 'ota-available',
        message: 'A faster version is ready.',
      });

    render(<MobileUpdateController />);

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

    expect(await screen.findByText('prompt:ota-available')).toBeTruthy();
    expect(mockResolveMobileUpdatePrompt).toHaveBeenCalledTimes(3);
  });

  it('fetches and reloads an accepted OTA update', async () => {
    mockResolveMobileUpdatePrompt.mockResolvedValue({
      kind: 'ota-available',
      message: 'A faster version is ready.',
    });

    render(<MobileUpdateController />);

    fireEvent.press(
      await screen.findByRole('button', { name: 'accept update' })
    );

    await waitFor(() => {
      expect(mockFetchUpdateAsync).toHaveBeenCalledTimes(1);
      expect(mockReloadAsync).toHaveBeenCalledTimes(1);
    });
  });

  it('opens the app store for accepted native updates', async () => {
    mockResolveMobileUpdatePrompt.mockResolvedValue({
      kind: 'native-required',
      message: 'Install the latest app.',
      storeUrl: 'https://apps.apple.com/app/id6472735367',
    });

    render(<MobileUpdateController />);

    fireEvent.press(
      await screen.findByRole('button', { name: 'accept update' })
    );

    await waitFor(() => {
      expect(mockOpenUrl).toHaveBeenCalledWith(
        'https://apps.apple.com/app/id6472735367'
      );
    });
  });

  it('dismisses optional prompts', async () => {
    mockResolveMobileUpdatePrompt.mockResolvedValue({
      kind: 'native-recommended',
      message: 'Install a newer app.',
      storeUrl: 'https://apps.apple.com/app/id6472735367',
    });

    render(<MobileUpdateController />);

    expect(await screen.findByText('prompt:native-recommended')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'dismiss update' }));

    expect(screen.queryByText('prompt:native-recommended')).toBeNull();
  });

  it('keeps required native prompts visible when dismiss is requested', async () => {
    mockResolveMobileUpdatePrompt.mockResolvedValue({
      kind: 'native-required',
      message: 'Install the latest app.',
      storeUrl: 'https://apps.apple.com/app/id6472735367',
    });

    render(<MobileUpdateController />);

    expect(await screen.findByText('prompt:native-required')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'dismiss update' }));

    expect(screen.getByText('prompt:native-required')).toBeTruthy();
  });

  it('clears optional prompts when accepting the update fails', async () => {
    mockFetchUpdateAsync.mockRejectedValue(new Error('fetch failed'));
    mockResolveMobileUpdatePrompt.mockResolvedValue({
      kind: 'ota-available',
      message: 'A faster version is ready.',
    });

    render(<MobileUpdateController />);

    fireEvent.press(
      await screen.findByRole('button', { name: 'accept update' })
    );

    await waitFor(() => {
      expect(screen.queryByText('prompt:ota-available')).toBeNull();
    });
  });

  it('keeps required native prompts visible when opening the store fails', async () => {
    mockOpenUrl.mockRejectedValue(new Error('store unavailable'));
    mockResolveMobileUpdatePrompt.mockResolvedValue({
      kind: 'native-required',
      message: 'Install the latest app.',
      storeUrl: 'https://apps.apple.com/app/id6472735367',
    });

    render(<MobileUpdateController />);

    fireEvent.press(
      await screen.findByRole('button', { name: 'accept update' })
    );

    await waitFor(() => {
      expect(mockOpenUrl).toHaveBeenCalledWith(
        'https://apps.apple.com/app/id6472735367'
      );
    });
    expect(screen.getByText('prompt:native-required')).toBeTruthy();
  });
});
