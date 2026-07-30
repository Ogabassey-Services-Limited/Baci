import '@testing-library/jest-dom/vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_KEYBOARD_CONTAINER_LABEL } from '../auth/app-keyboard-container.mock';

const mocks = vi.hoisted(() => {
  return {
    back: vi.fn(),
    routeParams: {} as { from?: string },
    invalidateStoreReadiness: vi.fn().mockResolvedValue(undefined),
    invalidateQueries: vi.fn(),
    mutationOptions: null as {
      onError?: (error: Error) => void;
      onSuccess?: (data: unknown) => Promise<void> | void;
    } | null,
    updateMerchantIdentitySettings: vi.fn().mockResolvedValue(undefined),
    useMerchant: vi.fn(),
  };
});

function createMutationMock<TData>() {
  return ({
    mutationFn,
    onError,
  }: {
    mutationFn: () => Promise<TData>;
    onError?: (error: Error) => void;
    onSuccess?: (data: TData) => Promise<void> | void;
  }) => ({
    isPending: false,
    mutate: async () => {
      try {
        const data = await mutationFn();
        await mocks.mutationOptions?.onSuccess?.(data);
      } catch (error) {
        onError?.(error as Error);
      }
    },
  });
}

function Text({ children }: { children?: React.ReactNode }) {
  return <span>{children}</span>;
}

vi.mock('@tanstack/react-query', () => ({
  useMutation: <TData,>(options: {
    mutationFn: () => Promise<TData>;
    onError?: (error: Error) => void;
    onSuccess?: (data: TData) => Promise<void> | void;
  }) => {
    mocks.mutationOptions = options as unknown as typeof mocks.mutationOptions;
    return createMutationMock<TData>()(options);
  },
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
}));

vi.mock('@/components/ui/AppFormScreen', async () => {
  const { createAppFormScreenMock } = await import(
    '../auth/app-form-screen.mock'
  );
  return createAppFormScreenMock();
});

vi.mock('@/components/store-settings/StoreSettingsDetailsCard', () => ({
  StoreSettingsDetailsCard: ({
    businessName,
    countryLabel,
    currency,
    onBusinessNameChange,
    onOpenCountryPicker,
    onPhoneChange,
    onSlugChange,
    onSupportPhoneChange,
    phone,
    slug,
    slugLocked,
    supportPhone,
  }: {
    businessName: string;
    countryLabel: string;
    currency: string;
    onBusinessNameChange: (text: string) => void;
    onOpenCountryPicker: () => void;
    onPhoneChange: (text: string) => void;
    onSlugChange: (text: string) => void;
    onSupportPhoneChange: (text: string) => void;
    phone: string;
    slug: string;
    slugLocked: boolean;
    supportPhone: string;
  }) => (
    <div>
      <Text>{`Business: ${businessName}`}</Text>
      <Text>{`Country: ${countryLabel}`}</Text>
      <Text>{`Currency: ${currency}`}</Text>
      <input
        aria-label="Business Name"
        onChange={(event) => onBusinessNameChange(event.target.value)}
        value={businessName}
      />
      <input
        aria-label="Phone Number"
        onChange={(event) => onPhoneChange(event.target.value)}
        value={phone}
      />
      <input
        aria-label="Support Phone"
        onChange={(event) => onSupportPhoneChange(event.target.value)}
        value={supportPhone}
      />
      <input
        aria-label="Store slug"
        onChange={(event) => {
          if (!slugLocked) onSlugChange(event.target.value);
        }}
        readOnly={slugLocked}
        value={slug}
      />
      <button
        aria-label="Open country picker"
        onClick={onOpenCountryPicker}
        type="button"
      />
    </div>
  ),
}));

vi.mock('@/components/store-settings/StoreSubscriptionCard', () => ({
  StoreSubscriptionCard: ({
    manageSubscriptionLabel,
    onManageSubscription,
    planLabel,
  }: {
    manageSubscriptionLabel: string;
    onManageSubscription: () => void;
    planLabel: string;
  }) => (
    <div>
      <Text>{`Plan: ${planLabel}`}</Text>
      <Text>{`Manage label: ${manageSubscriptionLabel}`}</Text>
      <button
        aria-label={manageSubscriptionLabel}
        onClick={onManageSubscription}
        type="button"
      />
    </div>
  ),
}));

vi.mock('@/components/ui/CountryPickerModal', () => ({
  CountryPickerModal: ({
    onClose,
    onSelect,
    visible,
  }: {
    onClose: () => void;
    onSelect: (country: {
      code: string;
      currency: string;
      name: string;
    }) => void;
    visible: boolean;
  }) =>
    visible ? (
      <div>
        <button
          aria-label="Choose Ghana"
          onClick={() =>
            onSelect({ code: 'GH', currency: 'GHS', name: 'Ghana' })
          }
          type="button"
        />
        <button
          aria-label="Close country picker"
          onClick={onClose}
          type="button"
        />
      </div>
    ) : null,
}));

vi.mock('@/components/ui/LogoPicker', () => ({
  LogoPicker: () => <div />,
}));

vi.mock('@/components/ui/ScreenSkeleton', () => ({
  ScreenSkeleton: () => <div />,
}));

vi.mock('@/components/ui/StatusModal', () => ({
  StatusModal: ({
    onClose,
    status,
  }: {
    onClose: () => void;
    status: { message: string; title: string; visible: boolean };
  }) =>
    status.visible ? (
      <div>
        <Text>{status.title}</Text>
        <Text>{status.message}</Text>
        <button
          aria-label="Close status modal"
          onClick={onClose}
          type="button"
        />
      </div>
    ) : null,
}));

vi.mock('@/hooks/useCachedImageUri', () => ({
  useCachedImageUri: () => ({ uri: 'https://example.com/logo.png' }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: mocks.useMerchant,
}));

vi.mock('@/lib/invalidate-store-readiness', () => ({
  invalidateStoreReadiness: mocks.invalidateStoreReadiness,
}));

vi.mock('@/hooks/useRevenueCat', () => ({
  useRevenueCat: () => ({ isPro: true }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#020617',
      border: '#334155',
      card: '#111827',
      cardHover: '#1f2937',
      primary: '#3b82f6',
      text: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8',
    },
    isDark: true,
    shadows: {
      sm: {},
    },
  }),
}));

vi.mock('@/lib/merchant-settings', () => ({
  updateMerchantIdentitySettings: mocks.updateMerchantIdentitySettings,
}));

vi.mock('@/utils/SubscriptionManagement', () => ({
  SubscriptionManagement: {
    getManagementLabel: () => 'Manage in App Store',
    getPlanLabel: (isPro: boolean) => (isPro ? 'Pro' : 'Free'),
    openNativeManagement: vi.fn(),
  },
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: ({ name }: { name?: string }) => (
    <span aria-hidden="true" data-icon={name} />
  ),

  default: ({ name }: { name?: string }) => (
    <span aria-hidden="true" data-icon={name} />
  ),
  __esModule: true,
}));

vi.mock('expo-router', async () => {
  const React = await import('react');

  return {
    Stack: {
      Screen: ({
        options,
      }: {
        options?: {
          headerLeft?: () => React.ReactNode;
          headerRight?: () => React.ReactNode;
          title?: string;
        };
      }) =>
        React.createElement(
          'div',
          null,
          options?.title
            ? React.createElement('span', null, options.title)
            : null,
          options?.headerLeft ? options.headerLeft() : null,
          options?.headerRight ? options.headerRight() : null
        ),
    },
    useRouter: () => ({
      back: mocks.back,
      push: vi.fn(),
    }),
    useLocalSearchParams: () => mocks.routeParams,
  };
});

vi.mock('react-native', () => ({
  StatusBar: () => null,
  ActivityIndicator: () => <output aria-label="loading" />,
  Platform: { OS: 'ios' },
  Pressable: ({
    accessibilityLabel,
    children,
    disabled,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: React.ReactNode;
    disabled?: boolean;
    onPress?: () => void;
  }) => (
    <button
      aria-label={accessibilityLabel}
      disabled={disabled}
      onClick={() => onPress?.()}
      type="button"
    >
      {children}
    </button>
  ),
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: React.ReactNode }) => (
    <span>{children}</span>
  ),
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

import StoreSettingsScreen from '@/app/(admin)/store-settings';
import { COUNTRIES } from '@/constants/countries';
import { SubscriptionManagement } from '@/utils/SubscriptionManagement';

// COUNTRIES is sorted by name, so the UI fallback default is COUNTRIES[0]
// (not necessarily Nigeria). Reference it directly so the tests stay correct
// if the country list changes.
const DEFAULT_COUNTRY = COUNTRIES[0];

describe('StoreSettingsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.routeParams = {};
    mocks.invalidateStoreReadiness.mockResolvedValue(undefined);
    mocks.updateMerchantIdentitySettings.mockResolvedValue(undefined);
    mocks.useMerchant.mockReturnValue({
      merchant: {
        id: 'merchant-1',
        business_address: '12 Allen Avenue',
        business_name: 'Baci Foods',
        country: 'NG',
        email: 'support@usebaci.com',
        logo_url: 'https://example.com/logo.png',
        payout_currency: 'NGN',
        phone: '+2348012345678',
        slug: 'baci-foods',
        support_email: 'support@usebaci.com',
        support_phone: '+2347000000000',
        updated_at: '2026-06-17T08:00:00.000Z',
      },
      isLoading: false,
    });
  });

  it('renders inside the shared form shell and updates country state from the picker', () => {
    render(<StoreSettingsScreen />);

    expect(
      screen.getByRole('region', { name: APP_KEYBOARD_CONTAINER_LABEL })
    ).toBeInTheDocument();
    expect(screen.getByText('Business: Baci Foods')).toBeInTheDocument();
    expect(screen.getByText('Country: Nigeria')).toBeInTheDocument();
    expect(screen.getByText('Currency: NGN')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Open country picker' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Choose Ghana' }));

    expect(screen.getByText('Country: Ghana')).toBeInTheDocument();
    expect(screen.getByText('Currency: GHS')).toBeInTheDocument();
  });

  it('sends only the edited column when one field changes', async () => {
    render(<StoreSettingsScreen />);

    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'Baci Foods Ltd' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );

    await waitFor(() => {
      expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledTimes(1);
    });
    expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledWith({
      expectedUpdatedAt: '2026-06-17T08:00:00.000Z',
      merchantId: 'merchant-1',
      settings: { business_name: 'Baci Foods Ltd' },
    });

    expect(await screen.findByText('Success!')).toBeInTheDocument();
  });

  it('preserves dirty edits when an app-focus merchant refetch returns a new object', () => {
    const rendered = render(<StoreSettingsScreen />);

    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'Unsaved local name' },
    });

    mocks.useMerchant.mockReturnValue({
      merchant: {
        ...mocks.useMerchant.mock.results.at(-1)?.value.merchant,
        business_name: 'Refetched server name',
        updated_at: '2026-06-17T08:01:00.000Z',
      },
      isLoading: false,
    });
    rendered.rerender(<StoreSettingsScreen />);

    expect(screen.getByLabelText('Business Name')).toHaveValue(
      'Unsaved local name'
    );
  });

  it('reseeds the form when merchant identity changes despite prior dirty edits', async () => {
    const rendered = render(<StoreSettingsScreen />);
    const firstMerchant = mocks.useMerchant.mock.results.at(-1)?.value.merchant;

    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'Unsaved first merchant name' },
    });
    mocks.useMerchant.mockReturnValue({
      merchant: {
        ...firstMerchant,
        business_name: 'Second Merchant Store',
        id: 'merchant-2',
        updated_at: '2026-06-17T08:01:00.000Z',
      },
      isLoading: false,
    });
    rendered.rerender(<StoreSettingsScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('Business Name')).toHaveValue(
        'Second Merchant Store'
      );
    });

    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'Second Merchant Store Ltd' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );

    await waitFor(() => {
      expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledWith({
        expectedUpdatedAt: '2026-06-17T08:01:00.000Z',
        merchantId: 'merchant-2',
        settings: { business_name: 'Second Merchant Store Ltd' },
      });
    });
  });

  it('keeps an edit made while a settings save is in flight dirty after it succeeds', async () => {
    let completeSave!: () => void;
    mocks.updateMerchantIdentitySettings.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          completeSave = resolve;
        })
    );
    const rendered = render(<StoreSettingsScreen />);
    const merchant = mocks.useMerchant.mock.results.at(-1)?.value.merchant;

    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'Saved server name' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );
    await waitFor(() => {
      expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'Typed while saving' },
    });
    completeSave();
    await screen.findByText('Success!');

    mocks.useMerchant.mockReturnValue({
      merchant: { ...merchant, business_name: 'Saved server name' },
      isLoading: false,
    });
    rendered.rerender(<StoreSettingsScreen />);

    expect(screen.getByLabelText('Business Name')).toHaveValue(
      'Typed while saving'
    );
  });

  it('stays on the setup form when another edit is made during its save', async () => {
    let completeSave!: () => void;
    let releaseInvalidation!: () => void;
    const invalidation = new Promise<void>((resolve) => {
      releaseInvalidation = resolve;
    });
    mocks.routeParams = { from: 'setup' };
    mocks.invalidateQueries.mockReturnValue(invalidation);
    mocks.updateMerchantIdentitySettings.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          completeSave = resolve;
        })
    );
    render(<StoreSettingsScreen />);

    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'Saved setup name' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );
    await waitFor(() => {
      expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'Unsaved setup name' },
    });
    completeSave();

    await waitFor(() => {
      expect(mocks.invalidateQueries).toHaveBeenCalledTimes(2);
    });
    await act(async () => {
      releaseInvalidation();
    });

    expect(mocks.back).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Business Name')).toHaveValue(
      'Unsaved setup name'
    );
  });

  it('invalidates readiness for the merchant that started a save after switching merchants', async () => {
    let completeSave!: () => void;
    mocks.updateMerchantIdentitySettings.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          completeSave = resolve;
        })
    );
    const rendered = render(<StoreSettingsScreen />);
    const firstMerchant = mocks.useMerchant.mock.results.at(-1)?.value.merchant;

    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'First merchant saved name' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );
    await waitFor(() => {
      expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledTimes(1);
    });

    mocks.useMerchant.mockReturnValue({
      merchant: {
        ...firstMerchant,
        business_name: 'Second Merchant Store',
        id: 'merchant-2',
        updated_at: '2026-06-17T08:01:00.000Z',
      },
      isLoading: false,
    });
    rendered.rerender(<StoreSettingsScreen />);
    completeSave();

    await waitFor(() => {
      expect(mocks.invalidateStoreReadiness).toHaveBeenCalledWith(
        expect.anything(),
        'merchant-1'
      );
    });
    expect(mocks.invalidateStoreReadiness).not.toHaveBeenCalledWith(
      expect.anything(),
      'merchant-2'
    );
  });

  it('does not show save success until merchant and readiness invalidations finish', async () => {
    let releaseReadiness!: () => void;
    const readiness = new Promise<void>((resolve) => {
      releaseReadiness = resolve;
    });
    mocks.invalidateStoreReadiness.mockReturnValueOnce(readiness);

    render(<StoreSettingsScreen />);
    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'Baci Foods Ltd' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );

    await waitFor(() => {
      expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledTimes(1);
      expect(mocks.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['merchant'],
      });
      expect(mocks.invalidateStoreReadiness).toHaveBeenCalledWith(
        expect.anything(),
        'merchant-1'
      );
    });
    expect(screen.queryByText('Success!')).not.toBeInTheDocument();

    releaseReadiness();

    expect(await screen.findByText('Success!')).toBeInTheDocument();
  });

  it('treats whitespace-only persisted slugs as first-time slug setup', async () => {
    mocks.useMerchant.mockReturnValue({
      merchant: {
        id: 'merchant-1',
        business_address: '12 Allen Avenue',
        business_name: 'Baci Foods',
        country: 'NG',
        email: 'support@usebaci.com',
        logo_url: 'https://example.com/logo.png',
        payout_currency: 'NGN',
        phone: '+2348012345678',
        slug: '   ',
        support_email: 'support@usebaci.com',
        support_phone: '+2347000000000',
        updated_at: '2026-06-17T08:00:00.000Z',
      },
      isLoading: false,
    });

    render(<StoreSettingsScreen />);

    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'Yodha Shopping' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );

    await waitFor(() => {
      expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledTimes(1);
    });
    expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledWith({
      expectedUpdatedAt: '2026-06-17T08:00:00.000Z',
      merchantId: 'merchant-1',
      settings: {
        business_name: 'Yodha Shopping',
        slug: 'yodha-shopping',
      },
    });
  });

  it('guards saves with the loaded updated_at concurrency token', async () => {
    render(<StoreSettingsScreen />);

    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'Baci Foods Ltd' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );

    await waitFor(() => {
      expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledTimes(1);
    });

    expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedUpdatedAt: '2026-06-17T08:00:00.000Z',
      })
    );
  });

  it('shows a conflict error when the OCC guard detects a stale write', async () => {
    mocks.updateMerchantIdentitySettings.mockRejectedValue(
      new Error(
        'These settings changed elsewhere. Reopen the page and try again.'
      )
    );

    render(<StoreSettingsScreen />);

    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'Baci Foods Ltd' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );

    await waitFor(() => {
      expect(screen.getByText('Update Failed')).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        'These settings changed elsewhere. Reopen the page and try again.'
      )
    ).toBeInTheDocument();
    expect(mocks.invalidateStoreReadiness).not.toHaveBeenCalled();
  });

  it('keeps phone and support_phone as distinct columns instead of collapsing them', async () => {
    render(<StoreSettingsScreen />);

    // The form must load the two phone columns into separate inputs.
    expect(
      (screen.getByLabelText('Phone Number') as HTMLInputElement).value
    ).toBe('+2348012345678');
    expect(
      (screen.getByLabelText('Support Phone') as HTMLInputElement).value
    ).toBe('+2347000000000');

    // Editing the support phone alone must not overwrite the primary phone.
    fireEvent.change(screen.getByLabelText('Support Phone'), {
      target: { value: '+2349999999999' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );

    await waitFor(() => {
      expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledTimes(1);
    });
    expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledWith({
      expectedUpdatedAt: '2026-06-17T08:00:00.000Z',
      merchantId: 'merchant-1',
      settings: { support_phone: '+2349999999999' },
    });
    const [{ settings }] = mocks.updateMerchantIdentitySettings.mock.calls[0];
    expect(settings).not.toHaveProperty('phone');
  });

  it('saves the prefilled merchant email as public support contact', async () => {
    mocks.useMerchant.mockReturnValue({
      merchant: {
        id: 'merchant-1',
        business_address: '12 Allen Avenue',
        business_name: 'Baci Foods',
        country: 'NG',
        email: 'owner@usebaci.com',
        logo_url: 'https://example.com/logo.png',
        payout_currency: 'NGN',
        phone: '',
        slug: 'baci-foods',
        support_email: null,
        support_phone: null,
        updated_at: '2026-06-17T08:00:00.000Z',
      },
      isLoading: false,
    });

    render(<StoreSettingsScreen />);

    fireEvent.change(screen.getByLabelText('Phone Number'), {
      target: { value: '+2348011111111' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );

    await waitFor(() => {
      expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledTimes(1);
    });
    expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledWith({
      expectedUpdatedAt: '2026-06-17T08:00:00.000Z',
      merchantId: 'merchant-1',
      settings: {
        phone: '+2348011111111',
        support_email: 'owner@usebaci.com',
      },
    });
  });

  it('does not run the mutation when nothing changed (empty diff)', async () => {
    render(<StoreSettingsScreen />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );

    expect(await screen.findByText('Success!')).toBeInTheDocument();
    // No edits → no write at all.
    expect(mocks.updateMerchantIdentitySettings).not.toHaveBeenCalled();
  });

  it('writes the default country/currency when they were never persisted', async () => {
    // Brand-new merchant: country/currency are null in the DB but the form
    // shows the default. Saving must write the defaults, not no-op.
    mocks.useMerchant.mockReturnValue({
      merchant: {
        id: 'merchant-1',
        business_address: '12 Allen Avenue',
        business_name: 'Baci Foods',
        country: null,
        payout_currency: null,
        email: 'support@usebaci.com',
        logo_url: 'https://example.com/logo.png',
        phone: '+2348012345678',
        slug: 'baci-foods',
        support_email: 'support@usebaci.com',
        support_phone: '+2347000000000',
        updated_at: '2026-06-17T08:00:00.000Z',
      },
      isLoading: false,
    });

    render(<StoreSettingsScreen />);

    // The picker shows the default even though nothing is persisted.
    expect(
      screen.getByText(`Country: ${DEFAULT_COUNTRY.name}`)
    ).toBeInTheDocument();
    expect(
      screen.getByText(`Currency: ${DEFAULT_COUNTRY.currency}`)
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );

    await waitFor(() => {
      expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledTimes(1);
    });
    // Saving the visible default persists the columns instead of an empty diff.
    expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledWith({
      expectedUpdatedAt: '2026-06-17T08:00:00.000Z',
      merchantId: 'merchant-1',
      settings: {
        country: DEFAULT_COUNTRY.code,
        payout_currency: DEFAULT_COUNTRY.currency,
      },
    });
  });

  it('does not show the status modal when native subscription management returns false', async () => {
    vi.mocked(
      SubscriptionManagement.openNativeManagement
    ).mockResolvedValueOnce(false);

    render(<StoreSettingsScreen />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Manage in App Store' })
    );

    await waitFor(() => {
      expect(SubscriptionManagement.openNativeManagement).toHaveBeenCalledTimes(
        1
      );
    });

    expect(
      screen.queryByText(
        'Could not open subscription management. Please try again.'
      )
    ).not.toBeInTheDocument();
  });

  it('shows an error modal when native subscription management rejects', async () => {
    vi.mocked(
      SubscriptionManagement.openNativeManagement
    ).mockRejectedValueOnce(new Error('fail'));

    render(<StoreSettingsScreen />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Manage in App Store' })
    );

    await waitFor(() => {
      expect(screen.getByText('Unable to Open')).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        'Could not open subscription management. Please try again.'
      )
    ).toBeInTheDocument();
  });
});
