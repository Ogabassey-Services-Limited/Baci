import { fireEvent, render, screen } from '@testing-library/react';
import { Suspense, startTransition, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  activeChecks: new Map<string, () => boolean>(),
  merchant: {
    bvn: null,
    cac_rc_number: null,
    country: 'NG',
    id: 'merchant-a',
    nin: null,
    phone: '+2348012345678',
    user_id: 'user-1',
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: {
      bvn_verified: false,
      cac_approved_name: null,
      cac_verified: false,
      date_of_birth: null,
      first_name: null,
      last_name: null,
      nin_verified: false,
    },
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('expo-router', () => ({ Stack: { Screen: () => null } }));
vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
  __esModule: true,
}));
vi.mock('@/components/kyc/NinVerificationCard', () => ({
  default: ({
    isActive,
    merchantId,
  }: {
    isActive: () => boolean;
    merchantId: string | null;
  }) => {
    if (merchantId) mocks.activeChecks.set(merchantId, isActive);
    return null;
  },
}));
vi.mock('@/components/kyc/CacVerificationCard', () => ({
  default: () => null,
}));
vi.mock('@/components/ui/AppKeyboardContainer', () => ({
  AppKeyboardContainer: ({ children }: { children?: React.ReactNode }) =>
    children,
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));
vi.mock('@/hooks/useKycVerificationRefresh', () => ({
  useKycVerificationRefresh: () => ({ refreshAfterVerification: vi.fn() }),
}));
vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({ merchant: mocks.merchant }),
}));
vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#020617',
      card: '#111827',
      error: '#ef4444',
      primary: '#3b82f6',
      text: '#f8fafc',
      textMuted: '#94a3b8',
      textSecondary: '#94a3b8',
    },
    isDark: true,
  }),
}));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('react-native', () => ({
  ActivityIndicator: () => null,
  Pressable: ({ children }: { children?: React.ReactNode }) => children,
  StatusBar: () => null,
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  Text: ({ children }: { children?: React.ReactNode }) => children,
  View: ({ children }: { children?: React.ReactNode }) => children,
}));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => children,
}));

import KYCScreen from './kyc';

describe('KYCScreen concurrent merchant rendering', () => {
  beforeEach(() => {
    mocks.activeChecks.clear();
    mocks.merchant = {
      bvn: null,
      cac_rc_number: null,
      country: 'NG',
      id: 'merchant-a',
      nin: null,
      phone: '+2348012345678',
      user_id: 'user-1',
    };
  });

  it('keeps merchant A verification callbacks active when merchant B render is abandoned', () => {
    const suspendedMerchantRender = new Promise<never>(() => undefined);

    function SuspendMerchantB({ merchantId }: { merchantId: string }) {
      if (merchantId === 'merchant-b') throw suspendedMerchantRender;
      return null;
    }

    function Scenario() {
      const [merchantId, setMerchantId] = useState('merchant-a');
      mocks.merchant = { ...mocks.merchant, id: merchantId };
      return (
        <>
          <button
            onClick={() => {
              startTransition(() => setMerchantId('merchant-b'));
            }}
            type="button"
          >
            Switch merchant
          </button>
          <Suspense fallback={<span>Loading merchant B</span>}>
            <KYCScreen />
            <SuspendMerchantB merchantId={merchantId} />
          </Suspense>
        </>
      );
    }

    render(<Scenario />);
    const merchantAIsActive = mocks.activeChecks.get('merchant-a');
    expect(merchantAIsActive?.()).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Switch merchant' }));

    expect(merchantAIsActive?.()).toBe(true);
  });
});
