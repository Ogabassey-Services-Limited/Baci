import type { ReactNode } from 'react';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  config: null as Record<string, unknown> | null,
  isError: false,
  isFetching: false,
  isLoading: false,
  loadError: null as Error | null,
  refetch: vi.fn(),
  register: vi.fn(),
  verify: vi.fn(),
  setEnabled: vi.fn(),
  getDomain: vi.fn(),
  invalidateQueries: vi.fn(),
  setQueryData: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: mocks.config,
    error: mocks.loadError,
    isError: mocks.isError,
    isFetching: mocks.isFetching,
    isLoading: mocks.isLoading,
    refetch: mocks.refetch,
  }),
  useMutation: ({
    mutationFn,
    onError,
    onSuccess,
  }: {
    mutationFn: (arg?: unknown) => Promise<unknown> | unknown;
    onError?: (error: unknown) => void;
    onSuccess?: (data: unknown) => void;
  }) => ({
    mutate: async (arg?: unknown) => {
      try {
        const result = await mutationFn(arg);
        onSuccess?.(result);
      } catch (error) {
        onError?.(error);
      }
    },
    isPending: false,
  }),
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
    setQueryData: mocks.setQueryData,
  }),
}));

vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
    Stack: { Screen: () => React.createElement('div', null) },
  };
});
vi.mock('expo-clipboard', () => ({ setStringAsync: vi.fn() }));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@react-native-vector-icons/ionicons', () => ({ default: () => null }));
vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#eee',
      card: '#fafafa',
      info: '#06c',
      error: '#d00',
      errorLight: '#fee',
      infoLight: '#def',
      primary: '#25f',
      success: '#1a3',
      successLight: '#dfd',
      text: '#012',
      textMuted: '#678',
      textSecondary: '#345',
    },
  }),
}));
vi.mock('@/lib/email-domain-api', () => ({
  getEmailDomain: mocks.getDomain,
  registerEmailDomain: mocks.register,
  verifyEmailDomain: mocks.verify,
  setEmailDomainEnabled: mocks.setEnabled,
}));

import EmailDomainSettingsScreen from './email-domain-settings';

describe('EmailDomainSettingsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.config = null;
    mocks.isError = false;
    mocks.isFetching = false;
    mocks.isLoading = false;
    mocks.loadError = null;
    mocks.invalidateQueries.mockReset();
    mocks.setQueryData.mockReset();
  });

  it('lets a merchant submit a new sending domain', async () => {
    render(<EmailDomainSettingsScreen />);
    fireEvent.change(screen.getByPlaceholderText('yourstore.com'), {
      target: { value: 'mystore.com' },
    });
    fireEvent.click(screen.getByText('Add domain'));
    await expect.poll(() => mocks.register).toHaveBeenCalledWith('mystore.com');
  });

  it('writes mutation results into the query cache before refetching', async () => {
    const nextConfig = {
      domain: 'mystore.com',
      senderLocalPart: 'noreply',
      status: 'pending',
      enabled: false,
      records: [],
    };
    mocks.register.mockResolvedValue(nextConfig);

    render(<EmailDomainSettingsScreen />);
    fireEvent.change(screen.getByPlaceholderText('yourstore.com'), {
      target: { value: 'mystore.com' },
    });
    fireEvent.click(screen.getByText('Add domain'));

    await expect
      .poll(() => mocks.setQueryData)
      .toHaveBeenCalledWith(['merchant', 'email-domain'], nextConfig);
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['merchant', 'email-domain'],
    });
  });

  it('shows the DNS records + a Verify action while pending', () => {
    mocks.config = {
      domain: 'mystore.com',
      senderLocalPart: 'noreply',
      status: 'pending',
      enabled: false,
      records: [
        {
          type: 'TXT',
          host: 'sel._domainkey.mystore.com',
          value: 'k=rsa; p=A',
        },
        { type: 'CNAME', host: 'bounce-zem.mystore.com', value: 'cluster.zm' },
      ],
    };
    render(<EmailDomainSettingsScreen />);

    expect(screen.getByText('Pending DNS')).toBeInTheDocument();
    expect(screen.getByText('sel._domainkey.mystore.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /verify/i }));
    expect(mocks.verify).toHaveBeenCalled();
  });

  it('shows a retry state when loading fails', () => {
    mocks.isError = true;
    mocks.loadError = new Error('network unavailable');

    render(<EmailDomainSettingsScreen />);

    expect(screen.getByText('network unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.refetch).toHaveBeenCalled();
  });

  it('keeps showing cached config when a background refetch fails', () => {
    mocks.isError = true;
    mocks.loadError = new Error('network unavailable');
    mocks.config = {
      domain: 'mystore.com',
      senderLocalPart: 'noreply',
      status: 'verified',
      enabled: true,
      records: [],
    };

    render(<EmailDomainSettingsScreen />);

    expect(screen.queryByText('network unavailable')).not.toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('shows failed verification copy instead of pending DNS copy', () => {
    mocks.config = {
      domain: 'mystore.com',
      senderLocalPart: 'noreply',
      status: 'failed',
      enabled: false,
      records: [],
    };
    render(<EmailDomainSettingsScreen />);

    expect(screen.getByText('Verification failed')).toBeInTheDocument();
    expect(screen.queryByText('Pending DNS')).not.toBeInTheDocument();
    expect(screen.getByText(/Check that the DKIM TXT/)).toBeInTheDocument();
  });

  it('toggles sending once the domain is verified', () => {
    mocks.config = {
      domain: 'mystore.com',
      senderLocalPart: 'noreply',
      status: 'verified',
      enabled: false,
      records: [],
    };
    render(<EmailDomainSettingsScreen />);

    expect(screen.getByText('Verified')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch'));
    expect(mocks.setEnabled).toHaveBeenCalledWith(true);
  });
});
