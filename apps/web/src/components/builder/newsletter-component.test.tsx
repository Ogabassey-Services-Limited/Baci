import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { getOnboardingPreviewThemeStyles } from '@/components/onboarding-preview/onboarding-preview-theme-styles';
import { getContrastRatio, hexToHslComponents } from '@/lib/color-utils';
import { deriveCuratedTheme } from '@/lib/storefront-defaults/derive-curated-theme';
import { NewsletterComponent } from './newsletter-component';

it('keeps required description text fully opaque on the primary surface', () => {
  render(
    <NewsletterComponent
      title="Updates"
      description="Receive updates."
      buttonText="Subscribe"
      placeholder="Email"
    />
  );

  expect(screen.getByText('Receive updates.')).not.toHaveClass('opacity-90');
  expect(
    screen.getByRole('textbox', { name: 'Email address for newsletter' })
  ).toHaveClass('bg-background');
  expect(screen.getByRole('button', { name: 'Subscribe' })).toHaveClass(
    'bg-secondary',
    'text-secondary-foreground'
  );
});

it.each([
  { primary: '#000000', background: '#ffffff', accent: '#777777' },
  { primary: '#ffffff', background: '#000000', accent: '#777777' },
  { primary: '#777777', background: '#777777', accent: '#ffffff' },
  {
    primary: '#ffffff',
    secondary: '#123456',
    background: '#000000',
    accent: '#777777',
  },
])('maps the real Newsletter secondary button pair to AA-safe Tailwind tokens', (colors) => {
  const theme = deriveCuratedTheme(colors, 'fashion');
  const styles = getOnboardingPreviewThemeStyles(colors, 'fashion');
  const tokens = styles as unknown as Record<string, string>;

  render(
    <div style={styles}>
      <NewsletterComponent
        title="Updates"
        description="Receive updates."
        buttonText="Subscribe"
      />
    </div>
  );
  expect(screen.getByRole('button', { name: 'Subscribe' })).toHaveClass(
    'bg-secondary',
    'text-secondary-foreground'
  );
  expect(tokens['--secondary']).toBe(
    hexToHslComponents(theme.colors.button.secondary.background)
  );
  expect(tokens['--secondary']).toBe(
    hexToHslComponents(theme.colors.secondary)
  );
  expect(tokens['--secondary-foreground']).toBe(
    hexToHslComponents(theme.colors.button.secondary.text)
  );
  expect(
    getContrastRatio(
      theme.colors.button.secondary.text,
      theme.colors.button.secondary.background
    )
  ).toBeGreaterThanOrEqual(4.5);
});
