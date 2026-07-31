import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface IdentityCardProps {
  dateOfBirth: string;
  firstName: string;
  lastName: string;
  merchantId: string | null;
  mobileNo: string;
}

const mocks = vi.hoisted(() => ({
  merchant: {
    bvn: null,
    cac_rc_number: null,
    country: 'NG',
    id: 'merchant-a',
    nin: null,
    phone: '+2348012345678',
    user_id: 'user-1',
  },
  renderedIdentityDrafts: [] as IdentityCardProps[],
  status: {
    bvn_verified: false,
    cac_approved_name: null,
    cac_verified: false,
    date_of_birth: '1990-01-01',
    first_name: 'Ada',
    last_name: 'Lovelace',
    nin_verified: false,
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: mocks.status,
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
  default: (props: IdentityCardProps) => {
    mocks.renderedIdentityDrafts.push(props);
    return null;
  },
}));

vi.mock('@/components/kyc/CacVerificationCard', () => ({
  default: () => null,
}));

vi.mock('@/components/ui/AppKeyboardContainer', () => ({
  AppKeyboardContainer: ({ children }: { children?: ReactNode }) => children,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/hooks/useKycVerificationRefresh', () => ({
  useKycVerificationRefresh: () => ({
    refreshAfterVerification: vi.fn(),
  }),
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
  Pressable: ({ children }: { children?: ReactNode }) => children,
  StatusBar: () => null,
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  Text: ({ children }: { children?: ReactNode }) => children,
  View: ({ children }: { children?: ReactNode }) => children,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => children,
}));

import KYCScreen from './kyc';

describe('KYCScreen identity draft ownership', () => {
  beforeEach(() => {
    mocks.merchant = {
      bvn: null,
      cac_rc_number: null,
      country: 'NG',
      id: 'merchant-a',
      nin: null,
      phone: '+2348012345678',
      user_id: 'user-1',
    };
    mocks.renderedIdentityDrafts = [];
    mocks.status = {
      bvn_verified: false,
      cac_approved_name: null,
      cac_verified: false,
      date_of_birth: '1990-01-01',
      first_name: 'Ada',
      last_name: 'Lovelace',
      nin_verified: false,
    };
  });

  it('does not render merchant A identity values during the first cached render for merchant B', () => {
    const { rerender } = render(<KYCScreen />);

    mocks.merchant = {
      ...mocks.merchant,
      id: 'merchant-b',
      phone: '+2348098765432',
    };
    mocks.status = {
      ...mocks.status,
      date_of_birth: '1985-02-03',
      first_name: 'Grace',
      last_name: 'Hopper',
    };
    const firstMerchantBRender = mocks.renderedIdentityDrafts.length;

    rerender(<KYCScreen />);

    expect(mocks.renderedIdentityDrafts[firstMerchantBRender]).toMatchObject({
      dateOfBirth: '',
      firstName: '',
      lastName: '',
      merchantId: 'merchant-b',
      mobileNo: '',
    });
  });
});
