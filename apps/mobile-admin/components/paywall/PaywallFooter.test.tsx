import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import type { PurchasesPackage } from 'react-native-purchases';
import PaywallFooter from './PaywallFooter';

const mocks = vi.hoisted(() => ({
  openURL: vi.fn(),
  platform: 'ios' as 'ios' | 'android' | 'web',
}));

vi.mock('@/config/runtime-platform', () => ({
  isRuntimePlatform: (platform: 'ios' | 'android' | 'web') =>
    mocks.platform === platform,
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <span>loading</span>,
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
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

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

    render(
      <PaywallFooter
        colors={colors}
        isLoading={false}
        isPro={false}
        onPurchase={onPurchase}
        onRestore={onRestore}
        selectedPackage={selectedPackage}
        stickyFooterPaddingBottom={24}
      />
    );

    expect(screen.getByText('Continue with Monthly')).toBeInTheDocument();
    expect(screen.getByText(/Apple ID settings/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /restore previous purchases/i }));
    expect(onRestore).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('link', { name: /view terms of service/i }));
    fireEvent.click(screen.getByRole('link', { name: /view privacy policy/i }));

    expect(mocks.openURL).toHaveBeenNthCalledWith(1, 'https://usebaci.com/terms');
    expect(mocks.openURL).toHaveBeenNthCalledWith(
      2,
      'https://usebaci.com/privacy'
    );

    fireEvent.click(screen.getByRole('button', { name: /subscribe to monthly/i }));
    expect(onPurchase).toHaveBeenCalledTimes(1);
  });

  it('switches disclosure settings label for Android', () => {
    mocks.platform = 'android';

    render(
      <PaywallFooter
        colors={colors}
        isLoading={false}
        isPro={false}
        onPurchase={() => undefined}
        onRestore={() => undefined}
        selectedPackage={selectedPackage}
        stickyFooterPaddingBottom={24}
      />
    );

    expect(screen.getByText(/Google Play settings/i)).toBeInTheDocument();
  });
});
