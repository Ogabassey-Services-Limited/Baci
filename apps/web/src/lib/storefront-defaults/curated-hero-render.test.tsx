import { render, screen } from '@testing-library/react';
import { colord } from 'colord';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { getContrastRatio } from '@/lib/color-utils';
import { buildCuratedCopy } from './build-curated-copy';
import { buildCuratedHero } from './build-curated-hero';
import { deriveCuratedTheme } from './derive-curated-theme';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: () => ({ basePath: '' }),
}));

const { builderConfig } = await import('@/components/builder/config');

it.each([
  'fashion',
  'food',
  'electronics',
  'pharmacy',
  'unknown-type',
])('renders the generated category gradient on the Hero section for %s', (businessType) => {
  const hero = buildCuratedHero(
    businessType,
    buildCuratedCopy({
      businessName: 'North Star',
      businessType,
      country: 'Nigeria',
    }).hero
  );
  const renderHero = builderConfig.components.Hero.render as (
    props: typeof hero
  ) => ReactNode;
  const { container } = render(renderHero(hero));
  expect(container.querySelector('section')).toHaveStyle({
    backgroundImage: hero.backgroundGradient,
  });
  expect(
    screen.getByRole('link', { name: 'Explore products' })
  ).toHaveAttribute('href', '#products');
});

const blackScrimmed = (color: string) => {
  const rgb = colord(color).toRgb();
  return colord({
    r: Math.round(rgb.r * 0.4),
    g: Math.round(rgb.g * 0.4),
    b: Math.round(rgb.b * 0.4),
  }).toHex();
};

type HeroSurfaceCase = {
  businessType: string;
  brandColors: { primary: string; accent: string; background: string };
  endpointNames: Array<'primary' | 'accent' | 'background'>;
};

const adversarialHeroThemes: HeroSurfaceCase[] = [
  {
    businessType: 'fashion',
    brandColors: {
      primary: '#000000',
      accent: '#FFFFFF',
      background: '#FFFFFF',
    },
    endpointNames: ['primary', 'accent'],
  },
  {
    businessType: 'food',
    brandColors: {
      primary: '#000000',
      accent: '#FFFFFF',
      background: '#FFFFFF',
    },
    endpointNames: ['accent', 'background'],
  },
  {
    businessType: 'electronics',
    brandColors: {
      primary: '#FFFFFF',
      accent: '#000000',
      background: '#000000',
    },
    endpointNames: ['primary', 'background'],
  },
  {
    businessType: 'pharmacy',
    brandColors: {
      primary: '#000000',
      accent: '#FFFFFF',
      background: '#101010',
    },
    endpointNames: ['accent', 'primary'],
  },
  {
    businessType: 'unknown-type',
    brandColors: {
      primary: '#FFFFFF',
      accent: '#000000',
      background: '#FFFFFF',
    },
    endpointNames: ['background', 'primary'],
  },
];

it.each(
  adversarialHeroThemes
)('renders an AA-readable Hero surface for $businessType with its actual adversarial theme endpoints', ({
  businessType,
  brandColors,
  endpointNames,
}) => {
  const theme = deriveCuratedTheme(brandColors, businessType);
  const hero = buildCuratedHero(
    businessType,
    buildCuratedCopy({
      businessName: 'North Star',
      businessType,
      country: 'Nigeria',
    }).hero
  );
  const renderHero = builderConfig.components.Hero.render as (
    props: typeof hero
  ) => ReactNode;
  const { container } = render(
    <div
      style={
        {
          '--store-primary': theme.colors.primary,
          '--store-accent': theme.colors.accent,
          '--store-background': theme.colors.background,
        } as React.CSSProperties
      }
    >
      {renderHero(hero)}
    </div>
  );

  expect(container.querySelector('[aria-hidden="true"]')).toHaveClass(
    'bg-black/60'
  );
  expect(container.firstElementChild).toHaveStyle({
    '--store-primary': theme.colors.primary,
    '--store-accent': theme.colors.accent,
    '--store-background': theme.colors.background,
  });
  expect(container.querySelector('section')).toHaveStyle({
    backgroundImage: hero.backgroundGradient,
  });
  expect(screen.getByRole('heading', { level: 1 }).parentElement).toHaveClass(
    'text-white'
  );
  for (const endpointName of endpointNames)
    expect(
      getContrastRatio('#FFFFFF', blackScrimmed(theme.colors[endpointName]))
    ).toBeGreaterThanOrEqual(4.5);
});

it('renders the starter heading hierarchy through real Builder components', () => {
  const renderHero = builderConfig.components.Hero.render as (
    props: ReturnType<typeof buildCuratedHero>
  ) => ReactNode;
  const renderText = builderConfig.components.Text.render as (props: {
    title: string;
    content: string;
    align: 'center';
  }) => ReactNode;
  const renderFeatures = builderConfig.components.Features.render as (props: {
    title: string;
    features: Array<{ title: string; description: string; icon: string }>;
  }) => ReactNode;
  const { container } = render(
    <>
      {renderHero(
        buildCuratedHero(
          'fashion',
          buildCuratedCopy({
            businessName: 'North Star',
            businessType: 'fashion',
            country: 'Nigeria',
          }).hero
        )
      )}
      {renderText({
        title: 'About North Star',
        content: 'Browse.',
        align: 'center',
      })}
      {renderFeatures({
        title: 'Browse styles',
        features: [{ title: 'Browse', description: 'Browse.', icon: 'search' }],
      })}
    </>
  );

  expect(container.querySelector('h1')).toHaveTextContent(
    'Explore styles from North Star'
  );
  expect(container.querySelector('h2')).toHaveTextContent('About North Star');
  expect(container.querySelector('h3')).toHaveTextContent('Browse');
});
