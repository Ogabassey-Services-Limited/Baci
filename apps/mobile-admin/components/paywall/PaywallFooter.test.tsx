import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { PurchasesPackage } from 'react-native-purchases';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import PaywallFooter from './PaywallFooter';

const mocks = vi.hoisted(() => ({
  openURL: vi.fn(),
  platform: 'ios' as 'ios' | 'android' | 'web',
}));

vi.mock('@/config/runtime-platform', () => ({
  isRuntimePlatform: (platform: 'ios' | 'android' | 'web') =>
    mocks.platform === platform,
}));

vi.mock('react-native', () => {
  const Text = ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  );

  return {
    StatusBar: () => null,
    ActivityIndicator: () => <Text>loading</Text>,
    Linking: { openURL: mocks.openURL },
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      children,
      disabled,
      onPress,
      style,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: 'button' | 'link';
      children?: ReactNode;
      disabled?: boolean;
      onPress?: () => void;
      style?: unknown;
    }) => {
      const resolvedStyle =
        typeof style === 'function' ? style({ pressed: false }) : style;
      return (
        <button
          type="button"
          role={accessibilityRole}
          aria-label={accessibilityLabel}
          data-has-style={Boolean(resolvedStyle)}
          disabled={disabled}
          onClick={() => onPress?.()}
        >
          {children}
        </button>
      );
    },
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text,
    View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  };
});

const colors = {
  background: '#ffffff',
  border: '#e2e8f0',
  primary: '#3b82f6',
  textMuted: '#64748b',
  textSecondary: '#334155',
} as ThemeColors;

const selectedPackage = {
  identifier: 'monthly',
  packageType: 'MONTHLY',
  product: {
    priceString: '$9.99',
    title: 'Monthly',
  },
} as PurchasesPackage;

describe('PaywallFooter', () => {
  afterEach(() => {
    mocks.openURL.mockReset();
    mocks.platform = 'ios';
  });

  it('renders platform-specific disclosure text and hooks footer actions', () => {
    const onPurchase = vi.fn();
    const onRestore = vi.fn();
    const onManageSubscription = vi.fn();

    render(
      <PaywallFooter
        colors={colors}
        isLoading={false}
        isPro={false}
        isSubscriptionStatusLoading={false}
        onManageSubscription={onManageSubscription}
        onPurchase={onPurchase}
        onReload={() => undefined}
        onRestore={onRestore}
        selectedPackage={selectedPackage}
        stickyFooterPaddingBottom={24}
      />
    );

    expect(screen.getByText('Continue with Monthly')).toBeInTheDocument();
    expect(screen.getByText(/Apple ID settings/i)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /restore previous purchases/i })
    );
    expect(onRestore).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole('link', { name: /view terms of service/i })
    );
    fireEvent.click(screen.getByRole('link', { name: /view privacy policy/i }));

    expect(mocks.openURL).toHaveBeenNthCalledWith(
      1,
      'https://usebaci.com/terms'
    );
    expect(mocks.openURL).toHaveBeenNthCalledWith(
      2,
      'https://usebaci.com/privacy'
    );

    fireEvent.click(
      screen.getByRole('button', { name: /subscribe to monthly/i })
    );
    expect(onPurchase).toHaveBeenCalledTimes(1);
    expect(onManageSubscription).not.toHaveBeenCalled();
  });

  it('uses the management action for Pro users instead of purchase', () => {
    const onPurchase = vi.fn();
    const onManageSubscription = vi.fn();

    render(
      <PaywallFooter
        colors={colors}
        isLoading={false}
        isPro={true}
        isSubscriptionStatusLoading={false}
        onManageSubscription={onManageSubscription}
        onPurchase={onPurchase}
        onReload={() => undefined}
        onRestore={() => undefined}
        selectedPackage={selectedPackage}
        stickyFooterPaddingBottom={24}
      />
    );

    expect(screen.queryByText(/Subscription auto-renews/i)).toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: /manage your subscription/i })
    );

    expect(onManageSubscription).toHaveBeenCalledTimes(1);
    expect(onPurchase).not.toHaveBeenCalled();
  });

  it('switches disclosure settings label for Android', () => {
    mocks.platform = 'android';

    render(
      <PaywallFooter
        colors={colors}
        isLoading={false}
        isPro={false}
        isSubscriptionStatusLoading={false}
        onManageSubscription={() => undefined}
        onPurchase={() => undefined}
        onReload={() => undefined}
        onRestore={() => undefined}
        selectedPackage={selectedPackage}
        stickyFooterPaddingBottom={24}
      />
    );

    expect(screen.getByText(/Google Play settings/i)).toBeInTheDocument();
  });

  it('uses a neutral label while subscription status is loading', () => {
    const onPurchase = vi.fn();

    render(
      <PaywallFooter
        colors={colors}
        isLoading={false}
        isPro={false}
        isSubscriptionStatusLoading={true}
        onManageSubscription={() => undefined}
        onPurchase={onPurchase}
        onReload={() => undefined}
        onRestore={() => undefined}
        selectedPackage={selectedPackage}
        stickyFooterPaddingBottom={24}
      />
    );

    const loadingButton = screen.getByRole('button', {
      name: /loading subscription status/i,
    });

    expect(loadingButton).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: /processing purchase/i })
    ).toBeNull();

    fireEvent.click(loadingButton);
    expect(onPurchase).not.toHaveBeenCalled();
  });

  it('offers a working Try again action when no package is available', () => {
    const onPurchase = vi.fn();
    const onReload = vi.fn();
    const onManageSubscription = vi.fn();

    render(
      <PaywallFooter
        colors={colors}
        isLoading={false}
        isPro={false}
        isSubscriptionStatusLoading={false}
        onManageSubscription={onManageSubscription}
        onPurchase={onPurchase}
        onReload={onReload}
        onRestore={() => undefined}
        selectedPackage={null}
        stickyFooterPaddingBottom={24}
      />
    );

    // The primary CTA must never be a dead, disabled "Continue with Pro" when
    // the offering is empty — that is exactly the Play "Broken Functionality"
    // violation. It becomes an enabled "Try again" that reloads the offering.
    const retryButton = screen.getByRole('button', {
      name: /reload subscription options/i,
    });

    expect(retryButton).not.toBeDisabled();
    expect(screen.getByText('Try again')).toBeInTheDocument();
    expect(screen.queryByText(/Continue with/i)).toBeNull();
    expect(screen.getByText(/couldn't load/i)).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(onPurchase).not.toHaveBeenCalled();
    expect(onManageSubscription).not.toHaveBeenCalled();
  });
});
