import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  config: null as Record<string, unknown> | null,
  isLoading: false,
  register: vi.fn(),
  verify: vi.fn(),
  setEnabled: vi.fn(),
  getDomain: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: mocks.config, isLoading: mocks.isLoading }),
  useMutation: ({
    mutationFn,
  }: {
    mutationFn: (arg?: unknown) => unknown;
  }) => ({
    mutate: (arg?: unknown) => mutationFn(arg),
    isPending: false,
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
    Stack: { Screen: () => React.createElement('div', null) },
  };
});
vi.mock('expo-clipboard', () => ({ setStringAsync: vi.fn() }));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@react-native-vector-icons/ionicons', () => ({ default: () => null }));
vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#eee',
      card: '#fafafa',
      info: '#06c',
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
    mocks.isLoading = false;
  });

  it('lets a merchant submit a new sending domain', () => {
    render(<EmailDomainSettingsScreen />);
    fireEvent.change(screen.getByPlaceholderText('yourstore.com'), {
      target: { value: 'mystore.com' },
    });
    fireEvent.click(screen.getByText('Add domain'));
    expect(mocks.register).toHaveBeenCalledWith('mystore.com');
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
