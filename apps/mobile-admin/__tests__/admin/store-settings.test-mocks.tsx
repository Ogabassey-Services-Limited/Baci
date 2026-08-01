import { vi } from 'vitest';

type MutationOptions = {
  mutationFn: (variables: unknown) => Promise<unknown>;
  onError?: (error: unknown, variables: unknown) => void;
  onSuccess?: (data: unknown) => Promise<void> | void;
};

export const mocks = {
  back: vi.fn(),
  invalidateQueries: vi.fn(),
  invalidateStoreReadiness: vi.fn().mockResolvedValue(undefined),
  mutationOptions: null as MutationOptions | null,
  routeParams: {} as { from?: string },
  updateMerchantIdentitySettings: vi.fn().mockResolvedValue(undefined),
  useMerchant: vi.fn(),
};

vi.mock('@tanstack/react-query', () => ({
  useMutation: <TData, TVariables>(options: {
    mutationFn: (variables: TVariables) => Promise<TData>;
    onError?: (error: Error, variables: TVariables) => void;
    onSuccess?: (data: TData) => Promise<void> | void;
  }) => {
    mocks.mutationOptions = options as MutationOptions;
    return {
      mutate: async (variables: TVariables) => {
        try {
          const data = await options.mutationFn(variables);
          await mocks.mutationOptions?.onSuccess?.(data);
        } catch (error) {
          options.onError?.(error as Error, variables);
        }
      },
    };
  },
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

vi.mock('@/components/ui/AppFormScreen', async () => {
  const { createAppFormScreenMock } = await import(
    '../auth/app-form-screen.mock'
  );
  return createAppFormScreenMock();
});

vi.mock('@/components/store-settings/StoreSettingsDetailsCard', () => ({
  StoreSettingsDetailsCard: (props: {
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
      <span>{`Business: ${props.businessName}`}</span>
      <span>{`Country: ${props.countryLabel}`}</span>
      <span>{`Currency: ${props.currency}`}</span>
      <input
        aria-label="Business Name"
        onChange={(event) => props.onBusinessNameChange(event.target.value)}
        value={props.businessName}
      />
      <input
        aria-label="Phone Number"
        onChange={(event) => props.onPhoneChange(event.target.value)}
        value={props.phone}
      />
      <input
        aria-label="Support Phone"
        onChange={(event) => props.onSupportPhoneChange(event.target.value)}
        value={props.supportPhone}
      />
      <input
        aria-label="Store slug"
        onChange={(event) =>
          !props.slugLocked && props.onSlugChange(event.target.value)
        }
        readOnly={props.slugLocked}
        value={props.slug}
      />
      <button
        aria-label="Open country picker"
        onClick={props.onOpenCountryPicker}
        type="button"
      />
    </div>
  ),
}));

vi.mock('@/components/store-settings/StoreSubscriptionCard', () => ({
  StoreSubscriptionCard: (props: {
    manageSubscriptionLabel: string;
    onManageSubscription: () => void;
    planLabel: string;
  }) => (
    <div>
      <span>{`Plan: ${props.planLabel}`}</span>
      <button
        aria-label={props.manageSubscriptionLabel}
        onClick={props.onManageSubscription}
        type="button"
      />
    </div>
  ),
}));

vi.mock('@/components/ui/CountryPickerModal', () => ({
  CountryPickerModal: (props: {
    onClose: () => void;
    onSelect: (country: {
      code: string;
      currency: string;
      name: string;
    }) => void;
    visible: boolean;
  }) =>
    props.visible ? (
      <div>
        <button
          aria-label="Choose Ghana"
          onClick={() =>
            props.onSelect({ code: 'GH', currency: 'GHS', name: 'Ghana' })
          }
          type="button"
        />
        <button
          aria-label="Close country picker"
          onClick={props.onClose}
          type="button"
        />
      </div>
    ) : null,
}));

vi.mock('@/components/ui/LogoPicker', () => ({ LogoPicker: () => <div /> }));
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
        <span>{status.title}</span>
        <span>{status.message}</span>
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
vi.mock('@/hooks/useMerchant', () => ({ useMerchant: mocks.useMerchant }));
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
    shadows: { sm: {} },
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
    useRouter: () => ({ back: mocks.back, push: vi.fn() }),
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
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  Text: ({ children }: { children?: React.ReactNode }) => (
    <span>{children}</span>
  ),
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));
