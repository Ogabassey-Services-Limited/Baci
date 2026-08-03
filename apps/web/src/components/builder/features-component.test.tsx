import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { getOnboardingPreviewThemeStyles } from '@/components/onboarding-preview/onboarding-preview-theme-styles';
import { getContrastRatio } from '@/lib/color-utils';
import { deriveCuratedTheme } from '@/lib/storefront-defaults/derive-curated-theme';
import { FeaturesComponent } from './features-component';

vi.mock('./animated-wrapper', () => ({
  AnimatedWrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

it('binds feature section copy to the muted token and cards to the preview foreground token', () => {
  render(
    <FeaturesComponent
      title="Browse products"
      subtitle="Compare available options."
      features={[
        { title: 'Browse', description: 'Find products.', icon: 'search' },
      ]}
    />
  );

  expect(
    screen.getByRole('heading', { level: 2, name: 'Browse products' })
  ).toHaveClass('text-muted-foreground');
  expect(screen.getByText('Compare available options.')).toHaveClass(
    'text-muted-foreground'
  );
  expect(screen.getByText('Find products.')).toHaveClass('text-foreground');
});

it.each([
  { primary: '#000000', background: '#ffffff', accent: '#777777' },
  { primary: '#ffffff', background: '#000000', accent: '#777777' },
  { primary: '#777777', background: '#777777', accent: '#ffffff' },
  { primary: '#757575', background: '#757575', accent: '#ffffff' },
])('keeps rendered Features section copy and card descriptions AA-safe', (colors) => {
  const theme = deriveCuratedTheme(colors, 'fashion');
  const styles = getOnboardingPreviewThemeStyles(colors, 'fashion');

  render(
    <div style={styles}>
      <FeaturesComponent
        title="Browse products"
        subtitle="Compare available options."
        features={[{ title: 'Browse', description: 'Find products.' }]}
      />
    </div>
  );
  expect(
    screen
      .getByRole('heading', { level: 2, name: 'Browse products' })
      .closest('section')
  ).toHaveClass('bg-muted');
  expect(
    screen.getByRole('heading', { level: 2, name: 'Browse products' })
  ).toHaveClass('text-muted-foreground');
  expect(screen.getByText('Compare available options.')).toHaveClass(
    'text-muted-foreground'
  );
  expect(screen.getByText('Find products.')).toHaveClass('text-foreground');
  expect(
    getContrastRatio(theme.colors.mutedForeground, theme.colors.muted)
  ).toBeGreaterThanOrEqual(4.5);
  expect(
    getContrastRatio(theme.colors.foreground, theme.colors.background)
  ).toBeGreaterThanOrEqual(4.5);
});
