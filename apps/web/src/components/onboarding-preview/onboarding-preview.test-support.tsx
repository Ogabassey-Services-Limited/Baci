import { render } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';

const mockPuckRenderState = vi.hoisted(() => ({
  errorMessage: null as string | null,
}));

vi.mock('@/lib/storefront-defaults/derive-curated-theme', () => ({
  deriveCuratedTheme: vi.fn(() => ({
    colors: {
      primary: '#000000',
      secondary: '#111111',
      accent: '#222222',
      background: '#FFFFFF',
      foreground: '#000000',
      muted: '#F5F5F5',
      mutedForeground: '#888888',
      border: '#E5E5E5',
      header: {
        background: '#FFFFFF',
        text: '#000000',
        iconColor: '#000000',
        searchBorder: '#E5E5E5',
        searchBackground: '#F5F5F5',
      },
      footer: {
        background: '#000000',
        text: '#FFFFFF',
        linkColor: '#CCCCCC',
        linkHoverColor: '#FFFFFF',
      },
      button: {
        primary: { background: '#000000', text: '#FFFFFF', hover: '#222222' },
        secondary: { background: '#FFFFFF', text: '#000000', hover: '#F5F5F5' },
        accent: { background: '#222222', text: '#FFFFFF', hover: '#333333' },
      },
      card: { background: '#FFFFFF', border: '#E5E5E5', text: '#000000' },
      input: {
        background: '#FFFFFF',
        border: '#E5E5E5',
        text: '#000000',
        placeholder: '#888888',
        focusBorder: '#000000',
      },
    },
  })),
}));
vi.mock('@puckeditor/core', () => ({
  Render: ({ data }: { data: unknown }) => {
    if (mockPuckRenderState.errorMessage)
      throw new Error(mockPuckRenderState.errorMessage);
    return <div data-testid="puck-render">{JSON.stringify(data)}</div>;
  },
}));
vi.mock('@/components/builder/config', () => ({ builderConfig: {} }));
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    size?: string;
    children: React.ReactNode;
  }) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));
vi.mock('@/hooks/use-merchant-client', () => ({
  MerchantProvider: ({
    children,
    initialMerchant,
  }: {
    children: React.ReactNode;
    initialMerchant?: { id?: string };
  }) => (
    <div data-testid="merchant-provider" data-merchant-id={initialMerchant?.id}>
      {children}
    </div>
  ),
}));
vi.mock('@/hooks/use-cart', () => ({
  CartProvider: ({
    children,
    merchantSlug,
  }: {
    children: React.ReactNode;
    merchantSlug?: string | null;
  }) => <div data-testid={`cart-provider:${merchantSlug}`}>{children}</div>,
}));

import { OnboardingPuckPreview } from '../onboarding-puck-preview';

export const previewProps = {
  businessName: 'Test Store',
  businessType: 'fashion',
  logoDataUri: 'data:image/png;base64,test',
  brandColors: { primary: '#000000', background: '#FFFFFF', accent: '#FF0000' },
};
export const renderPreview = (
  props: Partial<React.ComponentProps<typeof OnboardingPuckPreview>> = {}
) => render(<OnboardingPuckPreview {...previewProps} {...props} />);
export const setPuckRenderError = (errorMessage: string | null) => {
  mockPuckRenderState.errorMessage = errorMessage;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPuckRenderState.errorMessage = null;
});
