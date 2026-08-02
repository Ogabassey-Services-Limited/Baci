import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { buildCuratedCopy } from './build-curated-copy';
import { buildCuratedHero } from './build-curated-hero';

vi.mock('next/link', () => ({
  default: ({ children }: { children: ReactNode }) => (
    <a href="#products">{children}</a>
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
