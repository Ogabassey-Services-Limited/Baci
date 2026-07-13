import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isLoading: false,
  merchant: {
    country: null as string | null,
    id: 'merchant-1',
    legal_entity_name: null as string | null,
    registered_address: null as unknown,
    state_code: null as string | null,
    tax_identification_number: null as string | null,
    vat_rate: 7.5 as number | null,
    vat_registration_status: 'not_registered' as
      | 'not_registered'
      | 'registered'
      | 'exempt'
      | 'pending'
      | null,
  },
  taxMutations: {
    saveAddressMutation: { isPending: false, mutate: vi.fn() },
    saveLegalEntityMutation: { isPending: false, mutate: vi.fn() },
    saveTinMutation: { isPending: false, mutate: vi.fn() },
    updateVatMutation: { isPending: false, mutate: vi.fn() },
  },
}));

vi.mock('expo-router', () => ({
  Stack: { Screen: () => null },
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  StatusBar: () => null,
  StyleSheet: {
    create: (stylesInput: Record<string, unknown>) => stylesInput,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,

  default: ({ name }: { name: string }) => <span>{name}</span>,
  __esModule: true,
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({ isLoading: mocks.isLoading, merchant: mocks.merchant }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      card: '#f8fafc',
      cardHover: '#f1f5f9',
      text: '#0f172a',
      textSecondary: '#64748b',
    },
    isDark: false,
    shadows: { sm: {} },
  }),
}));

vi.mock('@/hooks/useTaxMutations', () => ({
  useTaxMutations: () => mocks.taxMutations,
}));

vi.mock('@/components/ui/ScreenSkeleton', () => ({
  ScreenSkeleton: () => <div>loading-skeleton</div>,
}));

vi.mock('@/components/tax/VatCard', () => ({
  VatCard: () => <div>vat-card</div>,
}));
vi.mock('@/components/tax/VatInfoCard', () => ({
  VatInfoCard: () => <div>vat-info-card</div>,
}));
vi.mock('@/components/tax/TinCard', () => ({
  TinCard: () => <div>tin-card</div>,
}));
vi.mock('@/components/tax/LegalEntityCard', () => ({
  LegalEntityCard: () => <div>legal-entity-card</div>,
}));
vi.mock('@/components/tax/AddressCard', () => ({
  AddressCard: () => <div>address-card</div>,
}));
vi.mock('@/components/tax/StatePickerModal', () => ({
  StatePickerModal: () => null,
}));
vi.mock('@/components/tax/TaxNoticeCard', () => ({
  TaxNoticeCard: () => <div>tax-notice-card</div>,
}));

// TaxRegionUnavailableCard is intentionally NOT mocked — its real render is
// part of what proves the gating branch renders the correct info state.

import TaxScreen from './tax';

describe('TaxScreen region gating', () => {
  beforeEach(() => {
    mocks.isLoading = false;
    mocks.merchant.country = null;
  });

  it('renders the Nigerian tax form when country is null (backward compat)', () => {
    render(<TaxScreen />);

    expect(screen.getByText('vat-card')).toBeInTheDocument();
    expect(screen.getByText('tin-card')).toBeInTheDocument();
    expect(screen.getByText('address-card')).toBeInTheDocument();
    expect(
      screen.queryByText('Tax settings unavailable')
    ).not.toBeInTheDocument();
  });

  it('renders the Nigerian tax form when country is NG', () => {
    mocks.merchant.country = 'NG';

    render(<TaxScreen />);

    expect(screen.getByText('vat-card')).toBeInTheDocument();
  });

  it('renders the region-unavailable state instead of the Nigerian form for a non-Nigerian merchant', () => {
    mocks.merchant.country = 'IN';

    render(<TaxScreen />);

    expect(screen.getByText('Tax settings unavailable')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Tax settings are currently available for Nigerian merchants only — support for your region is coming.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('vat-card')).not.toBeInTheDocument();
    expect(screen.queryByText('tin-card')).not.toBeInTheDocument();
    expect(screen.queryByText('address-card')).not.toBeInTheDocument();
  });

  it('normalizes lowercase/whitespace country codes before gating', () => {
    mocks.merchant.country = ' ae ';

    render(<TaxScreen />);

    expect(screen.getByText('Tax settings unavailable')).toBeInTheDocument();
  });

  it('shows the loading skeleton before gating on country', () => {
    mocks.isLoading = true;
    mocks.merchant.country = 'IN';

    render(<TaxScreen />);

    expect(screen.getByText('loading-skeleton')).toBeInTheDocument();
    expect(
      screen.queryByText('Tax settings unavailable')
    ).not.toBeInTheDocument();
  });
});
