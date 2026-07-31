import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DARK_COLORS, SHADOWS } from '@/constants/theme';
import type { AnalyticsState } from '@/lib/analytics-config-diff';
import { AnalyticsPlatformCards } from './AnalyticsPlatformCards';

const { openURL } = vi.hoisted(() => ({ openURL: vi.fn() }));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: () => null,
}));

vi.mock('react-native', () => ({
  Linking: { openURL },
  Pressable: ({
    accessibilityLabel,
    accessibilityRole,
    accessibilityState,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    accessibilityRole?: string;
    accessibilityState?: { expanded?: boolean };
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button
      aria-expanded={accessibilityState?.expanded}
      aria-label={accessibilityLabel}
      onClick={onPress}
      role={accessibilityRole}
      type="button"
    >
      {children}
    </button>
  ),
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  TextInput: ({
    accessibilityLabel,
    onChangeText,
    placeholder,
    value,
  }: {
    accessibilityLabel?: string;
    onChangeText?: (value: string) => void;
    placeholder?: string;
    value?: string;
  }) => (
    <input
      aria-label={accessibilityLabel}
      onChange={(event) => onChangeText?.(event.target.value)}
      placeholder={placeholder}
      value={value}
    />
  ),
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

const analytics: AnalyticsState = {
  facebook_pixel_id: '',
  facebook_capi_token: '',
  ga4_api_secret: '',
  google_analytics_id: '',
  offline_conversions_enabled: false,
  snapchat_capi_token: '',
  snapchat_pixel_id: '',
  tiktok_access_token: '',
  tiktok_pixel_id: '',
};

function renderCards(
  overrides: Partial<ComponentProps<typeof AnalyticsPlatformCards>> = {}
) {
  const props = {
    analytics,
    colors: DARK_COLORS,
    expandedSection: null,
    onToggleSection: vi.fn(),
    shadows: SHADOWS,
    updateField: vi.fn(),
    ...overrides,
  };

  render(<AnalyticsPlatformCards {...props} />);
  return props;
}

describe('AnalyticsPlatformCards', () => {
  it('renders every supported analytics provider', () => {
    renderCards();

    expect(screen.getByText('Meta (Facebook/Instagram)')).toBeInTheDocument();
    expect(screen.getByText('TikTok')).toBeInTheDocument();
    expect(screen.getByText('Google Analytics 4 & Ads')).toBeInTheDocument();
    expect(screen.getByText('Snapchat')).toBeInTheDocument();
  });

  it('sends edited Meta credentials to the analytics state owner', () => {
    const updateField = vi.fn();
    renderCards({ expandedSection: 'facebook', updateField });

    fireEvent.change(screen.getByLabelText('Pixel ID'), {
      target: { value: '1234567890' },
    });

    expect(updateField).toHaveBeenCalledWith('facebook_pixel_id', '1234567890');
  });

  it('exposes each collapsed credential section as an expandable button', () => {
    renderCards();

    expect(
      screen.getByRole('button', {
        expanded: false,
        name: 'Meta (Facebook/Instagram) analytics credentials, not configured',
      })
    ).toBeInTheDocument();
  });

  it('exposes expanded credentials and help controls with programmatic names', () => {
    renderCards({ expandedSection: 'facebook' });

    expect(
      screen.getByRole('button', {
        expanded: true,
        name: 'Meta (Facebook/Instagram) analytics credentials, not configured',
      })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Pixel ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Conversions API Token')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'How to get your Meta (Facebook/Instagram) credentials',
      })
    ).toBeInTheDocument();
  });

  it('requests a section toggle and opens the selected provider help link', () => {
    const onToggleSection = vi.fn();
    renderCards({ expandedSection: 'facebook', onToggleSection });

    fireEvent.click(screen.getByRole('button', { name: /TikTok/ }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'How to get your Meta (Facebook/Instagram) credentials',
      })
    );

    expect(onToggleSection).toHaveBeenCalledWith('tiktok');
    expect(openURL).toHaveBeenCalledWith(
      'https://www.facebook.com/business/help/952192354843755'
    );
  });
});
