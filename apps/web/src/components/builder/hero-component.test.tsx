import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { heroComponent } from './hero-component';

const animatedWrapperState = vi.hoisted(() => ({
  animation: undefined as
    | { duration?: string; trigger?: string; type?: string }
    | undefined,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('./animated-wrapper', () => ({
  AnimatedWrapper: ({
    animation,
    children,
  }: {
    animation: { duration?: string; trigger?: string; type?: string };
    children: ReactNode;
  }) => {
    animatedWrapperState.animation = animation;
    return <>{children}</>;
  },
}));
vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: () => ({ basePath: '' }),
}));

it('renders a gradient without changing the existing Hero contract', () => {
  const renderHero = heroComponent.render as (props: {
    title: string;
    subtitle: string;
    ctaText: string;
    ctaLink: string;
    align: 'center';
    padding: 'large';
    headingLevel: 'h1';
    backgroundGradient: string;
  }) => ReactNode;
  const { container } = render(
    renderHero({
      title: 'North Star',
      subtitle: 'Browse products.',
      ctaText: 'Explore products',
      ctaLink: '/collections',
      align: 'center',
      padding: 'large',
      headingLevel: 'h1',
      backgroundGradient: 'linear-gradient(#fff, #eee)',
    })
  );
  expect(container.querySelector('h1')).toHaveTextContent('North Star');
  expect(container.querySelector('section')).toHaveStyle({
    backgroundImage: 'linear-gradient(#fff, #eee)',
  });
  expect(
    screen.getByRole('link', { name: 'Explore products' })
  ).toHaveAttribute('href', '/collections');
});

it('defaults missing and unknown animation inputs to normal scroll behavior', () => {
  const renderHero = heroComponent.render as (props: {
    title: string;
    subtitle: string;
    ctaText: string;
    ctaLink: string;
    align: 'center';
    padding: 'large';
    animationDuration?: string;
    animationTrigger?: string;
  }) => ReactNode;

  render(
    renderHero({
      title: 'North Star',
      subtitle: 'Browse products.',
      ctaText: 'Explore products',
      ctaLink: '/collections',
      align: 'center',
      padding: 'large',
      animationDuration: 'unexpected',
      animationTrigger: 'unexpected',
    })
  );

  expect(animatedWrapperState.animation).toMatchObject({
    duration: 'normal',
    trigger: 'scroll',
  });

  render(
    renderHero({
      title: 'North Star',
      subtitle: 'Browse products.',
      ctaText: 'Explore products',
      ctaLink: '/collections',
      align: 'center',
      padding: 'large',
    })
  );

  expect(animatedWrapperState.animation).toMatchObject({
    duration: 'normal',
    trigger: 'scroll',
  });
});

it('preserves supported animation duration and trigger values', () => {
  const renderHero = heroComponent.render as (props: {
    title: string;
    subtitle: string;
    ctaText: string;
    ctaLink: string;
    align: 'center';
    padding: 'large';
    animationDuration: string;
    animationTrigger: string;
  }) => ReactNode;

  render(
    renderHero({
      title: 'North Star',
      subtitle: 'Browse products.',
      ctaText: 'Explore products',
      ctaLink: '/collections',
      align: 'center',
      padding: 'large',
      animationDuration: 'slow',
      animationTrigger: 'immediate',
    })
  );

  expect(animatedWrapperState.animation).toMatchObject({
    duration: 'slow',
    trigger: 'immediate',
  });
});
