import '@testing-library/jest-dom/vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JUMIA_CONNECTION_STATUS } from '@/constants/marketplace';
import { JumiaChannelCard } from './JumiaChannelCard';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  apiClient: vi.fn(),
  invalidateQueries: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: () =>
      React.createElement('div', { role: 'progressbar' }),
    Alert: { alert: mocks.alert },
    Pressable: ({
      children,
      disabled,
      onPress,
    }: {
      children?: React.ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        { disabled, onClick: () => onPress?.(), type: 'button' },
        children
      ),
    StyleSheet: {
      create: <T,>(styles: T) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

vi.mock('expo-auth-session', () => ({
  makeRedirectUri: vi.fn(() => 'baciadmin:///sales-channels'),
}));

vi.mock('expo-linking', () => ({
  parse: vi.fn(() => ({ queryParams: {} })),
}));

vi.mock('expo-web-browser', () => ({
  openAuthSessionAsync: vi.fn(),
}));

vi.mock('@baci/shared', () => ({
  JUMIA_MOBILE_RETURN_URL: 'baciadmin:///sales-channels',
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({ merchant: { id: 'merchant-1' } }),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: (...args: unknown[]) => mocks.apiClient(...args),
}));

const colors = {
  border: '#ddd',
  card: '#fff',
  cardHover: '#f5f5f5',
  error: '#dc2626',
  errorLight: '#fee2e2',
  primary: '#2563eb',
  success: '#16a34a',
  successLight: '#dcfce7',
  text: '#111',
  textMuted: '#777',
  textSecondary: '#555',
  warning: '#ca8a04',
};

describe('JumiaChannelCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiClient.mockResolvedValue({ success: true });
  });

  it('disconnects connected Jumia integrations after confirmation', async () => {
    mocks.useQuery.mockReturnValue({
      data: { integrations: [{ id: 'int-1' }, { id: 'int-2' }] },
      isError: false,
      isFetching: false,
      isLoading: false,
    });

    render(<JumiaChannelCard colors={colors} shadows={{ sm: {} }} />);

    fireEvent.click(
      screen.getByRole('button', { name: /disconnect jumia account/i })
    );

    expect(mocks.alert).toHaveBeenCalledWith(
      'Disconnect Jumia Account?',
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Disconnect' }),
      ])
    );

    const buttons = mocks.alert.mock.calls[0]?.[2] as
      | Array<{ onPress?: () => void; text: string }>
      | undefined;
    await act(async () => {
      buttons?.find((button) => button.text === 'Disconnect')?.onPress?.();
    });

    await waitFor(() => {
      expect(mocks.apiClient).toHaveBeenCalledWith(
        '/api/marketplace/jumia/connect?id=int-1',
        { method: 'DELETE' }
      );
      expect(mocks.apiClient).toHaveBeenCalledWith(
        '/api/marketplace/jumia/connect?id=int-2',
        { method: 'DELETE' }
      );
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: [JUMIA_CONNECTION_STATUS, 'merchant-1'],
    });
    expect(mocks.alert).toHaveBeenLastCalledWith(
      'Disconnected',
      'Jumia account disconnected'
    );
  });

  it('refreshes status and shows the API error when disconnect fails', async () => {
    const disconnectError = new Error('Network failed');
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mocks.apiClient.mockRejectedValue(disconnectError);
    mocks.useQuery.mockReturnValue({
      data: { integrations: [{ id: 'int-1' }] },
      isError: false,
      isFetching: false,
      isLoading: false,
    });

    render(<JumiaChannelCard colors={colors} shadows={{ sm: {} }} />);

    fireEvent.click(
      screen.getByRole('button', { name: /disconnect jumia account/i })
    );

    const buttons = mocks.alert.mock.calls[0]?.[2] as
      | Array<{ onPress?: () => void; text: string }>
      | undefined;
    await act(async () => {
      buttons?.find((button) => button.text === 'Disconnect')?.onPress?.();
    });

    await waitFor(() => {
      expect(mocks.alert).toHaveBeenLastCalledWith(
        'Error',
        'Network failed'
      );
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: [JUMIA_CONNECTION_STATUS, 'merchant-1'],
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[JumiaChannelCard] disconnect failed',
      { name: 'Error', message: 'Network failed' }
    );
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.any(String),
      disconnectError
    );
    consoleErrorSpy.mockRestore();
  });

  it('refreshes status when one of multiple disconnect requests fails', async () => {
    mocks.apiClient
      .mockResolvedValueOnce({ success: true })
      .mockRejectedValueOnce(new Error('Second integration failed'));
    mocks.useQuery.mockReturnValue({
      data: { integrations: [{ id: 'int-1' }, { id: 'int-2' }] },
      isError: false,
      isFetching: false,
      isLoading: false,
    });

    render(<JumiaChannelCard colors={colors} shadows={{ sm: {} }} />);

    fireEvent.click(
      screen.getByRole('button', { name: /disconnect jumia account/i })
    );

    const buttons = mocks.alert.mock.calls[0]?.[2] as
      | Array<{ onPress?: () => void; text: string }>
      | undefined;
    await act(async () => {
      buttons?.find((button) => button.text === 'Disconnect')?.onPress?.();
    });

    await waitFor(() => {
      expect(mocks.invalidateQueries).toHaveBeenCalledWith({
        queryKey: [JUMIA_CONNECTION_STATUS, 'merchant-1'],
      });
      expect(mocks.alert).toHaveBeenLastCalledWith(
        'Error',
        'Second integration failed'
      );
    });
  });

  it('logs all sanitized disconnect failures when multiple requests fail', async () => {
    const firstError = new Error('First integration failed');
    const secondError = new Error('Second integration failed');
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mocks.apiClient
      .mockRejectedValueOnce(firstError)
      .mockRejectedValueOnce(secondError);
    mocks.useQuery.mockReturnValue({
      data: { integrations: [{ id: 'int-1' }, { id: 'int-2' }] },
      isError: false,
      isFetching: false,
      isLoading: false,
    });

    render(<JumiaChannelCard colors={colors} shadows={{ sm: {} }} />);

    fireEvent.click(
      screen.getByRole('button', { name: /disconnect jumia account/i })
    );

    const buttons = mocks.alert.mock.calls[0]?.[2] as
      | Array<{ onPress?: () => void; text: string }>
      | undefined;
    await act(async () => {
      buttons?.find((button) => button.text === 'Disconnect')?.onPress?.();
    });

    await waitFor(() => {
      expect(mocks.alert).toHaveBeenLastCalledWith(
        'Error',
        'First integration failed'
      );
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[JumiaChannelCard] disconnect failures',
      [
        { name: 'Error', message: 'First integration failed' },
        { name: 'Error', message: 'Second integration failed' },
      ]
    );
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.any(String),
      firstError
    );
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.any(String),
      secondError
    );
    consoleErrorSpy.mockRestore();
  });

  it('disables the action while connection status is loading', () => {
    mocks.useQuery.mockReturnValue({
      data: undefined,
      isError: false,
      isFetching: false,
      isLoading: true,
    });

    render(<JumiaChannelCard colors={colors} shadows={{ sm: {} }} />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);

    fireEvent.click(button);

    expect(mocks.apiClient).not.toHaveBeenCalled();
    expect(mocks.alert).not.toHaveBeenCalled();
  });

  it('shows the connect action when Jumia is not connected', () => {
    mocks.useQuery.mockReturnValue({
      data: { integrations: [] },
      isError: false,
      isFetching: false,
      isLoading: false,
    });

    render(<JumiaChannelCard colors={colors} shadows={{ sm: {} }} />);

    expect(
      screen.getByRole('button', { name: /connect jumia account/i })
    ).toBeInTheDocument();
  });

  it('logs sanitized details when Jumia connect fails', async () => {
    const connectError = new Error('Ticket request failed');
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mocks.apiClient.mockRejectedValue(connectError);
    mocks.useQuery.mockReturnValue({
      data: { integrations: [] },
      isError: false,
      isFetching: false,
      isLoading: false,
    });

    render(<JumiaChannelCard colors={colors} shadows={{ sm: {} }} />);

    fireEvent.click(
      screen.getByRole('button', { name: /connect jumia account/i })
    );

    await waitFor(() => {
      expect(mocks.alert).toHaveBeenLastCalledWith(
        'Error',
        'Ticket request failed'
      );
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[JumiaChannelCard] connect failed',
      { name: 'Error', message: 'Ticket request failed' }
    );
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.any(String),
      connectError
    );
    consoleErrorSpy.mockRestore();
  });
});
