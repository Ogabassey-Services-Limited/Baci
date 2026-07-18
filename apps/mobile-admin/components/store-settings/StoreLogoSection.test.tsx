import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS, SHADOWS } from '@/constants/theme';
import { StoreLogoSection } from './StoreLogoSection';

vi.mock('@/components/ui/LogoPicker', () => ({
  LogoPicker: ({
    businessName,
    cachedLogoUri,
    fallbackLogoUri,
    merchantId,
  }: {
    businessName: string;
    cachedLogoUri: string | null;
    fallbackLogoUri: string | null;
    merchantId: string | undefined;
  }) => {
    const logoStatus = cachedLogoUri ? 'Logo selected' : 'No logo selected';
    const fallbackStatus = fallbackLogoUri
      ? 'Original logo available'
      : 'No original logo';
    const merchantStatus = merchantId ? 'Merchant ready' : 'Merchant missing';

    return (
      <section aria-label="Logo picker">
        <p>{businessName || 'Unnamed store'}</p>
        <p>{logoStatus}</p>
        <p>{fallbackStatus}</p>
        <p>{merchantStatus}</p>
      </section>
    );
  },
}));

vi.mock('react-native', () => ({
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

describe('StoreLogoSection', () => {
  it('renders the logo picker with merchant logo context', () => {
    // Arrange & Act
    render(
      <StoreLogoSection
        businessName="Yodha Shopping"
        cachedLogoUri="https://example.com/logo.png"
        colors={LIGHT_COLORS}
        fallbackLogoUri="https://example.com/original-logo.png"
        merchantId="merchant-1"
        onStatusChange={vi.fn()}
        onUploadSuccess={vi.fn()}
        shadowStyle={SHADOWS.sm}
      />
    );

    // Assert
    expect(screen.getByText('Store Logo')).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Logo picker' })
    ).toBeInTheDocument();
    expect(screen.getByText('Yodha Shopping')).toBeInTheDocument();
    expect(screen.getByText('Logo selected')).toBeInTheDocument();
    expect(screen.getByText('Original logo available')).toBeInTheDocument();
    expect(screen.getByText('Merchant ready')).toBeInTheDocument();
  });

  it('renders the logo picker empty state without merchant or cached logo', () => {
    // Arrange & Act
    render(
      <StoreLogoSection
        businessName=""
        cachedLogoUri={null}
        colors={LIGHT_COLORS}
        fallbackLogoUri={null}
        merchantId={undefined}
        onStatusChange={vi.fn()}
        onUploadSuccess={vi.fn()}
        shadowStyle={SHADOWS.sm}
      />
    );

    // Assert
    expect(screen.getByText('Store Logo')).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Logo picker' })
    ).toBeInTheDocument();
    expect(screen.getByText('Unnamed store')).toBeInTheDocument();
    expect(screen.getByText('No logo selected')).toBeInTheDocument();
    expect(screen.getByText('No original logo')).toBeInTheDocument();
    expect(screen.getByText('Merchant missing')).toBeInTheDocument();
  });
});
