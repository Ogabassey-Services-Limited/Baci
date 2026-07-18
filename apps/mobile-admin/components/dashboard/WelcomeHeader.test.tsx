import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WelcomeHeader } from './WelcomeHeader';

const { useCachedImageUriMock } = vi.hoisted(() => ({
  useCachedImageUriMock: vi.fn(),
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: () => null,
}));

vi.mock('react-native-svg', () => ({
  SvgUri: () => null,
}));

vi.mock('@/components/BaciLogo', () => ({
  BaciLogo: () => <span aria-label="Baci logo" role="img" />,
}));

vi.mock('@/components/ui/SafeImage', async () => {
  const ReactModule = await import('react');

  return {
    default: ({
      resizeMethod,
      source,
    }: {
      resizeMethod?: string;
      source?: unknown;
    }) =>
      ReactModule.createElement('span', {
        'aria-label': 'merchant avatar',
        'data-resize-method': resizeMethod,
        'data-source': JSON.stringify(source),
        role: 'img',
      }),
  };
});

vi.mock('@/hooks/useCachedImageUri', () => ({
  useCachedImageUri: useCachedImageUriMock,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      card: '#f8fafc',
      gold: '#ca8a04',
      live: '#16a34a',
      notification: '#dc2626',
      primary: '#2563eb',
      text: '#0f172a',
      textMuted: '#94a3b8',
      textOnNotification: '#ffffff',
      textOnPrimary: '#ffffff',
    },
  }),
}));

vi.mock('react-native', async () => {
  const ReactModule = await import('react');

  return {
    Pressable: ({ children }: { children?: React.ReactNode }) =>
      ReactModule.createElement('button', null, children),
    StyleSheet: {
      create: <T extends Record<string, unknown>>(styles: T) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      ReactModule.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      ReactModule.createElement('div', null, children),
  };
});

describe('WelcomeHeader', () => {
  beforeEach(() => {
    useCachedImageUriMock.mockReset();
    useCachedImageUriMock.mockImplementation((uri: string) => ({
      isLoading: false,
      uri,
    }));
  });

  it('requests a target-sized avatar and bounded bitmap decoding', () => {
    const avatarUrl = 'https://example.com/avatar.png';

    render(<WelcomeHeader avatarUrl={avatarUrl} storeUrl="shop.example.com" />);

    expect(useCachedImageUriMock).toHaveBeenCalledWith(avatarUrl, {
      height: 192,
      resize: 'cover',
      width: 192,
    });
    expect(
      screen.getByRole('img', { name: 'merchant avatar' })
    ).toHaveAttribute('data-resize-method', 'resize');
  });

  it('renders the Baci logo fallback when no avatar is available', () => {
    render(<WelcomeHeader storeUrl="shop.example.com" />);

    expect(screen.getByRole('img', { name: 'Baci logo' })).toBeInTheDocument();
    expect(useCachedImageUriMock).toHaveBeenCalledWith(undefined, {
      height: 192,
      resize: 'cover',
      width: 192,
    });
  });
});
