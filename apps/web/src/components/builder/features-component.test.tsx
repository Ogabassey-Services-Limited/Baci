import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { FeaturesComponent } from './features-component';

vi.mock('./animated-wrapper', () => ({
  AnimatedWrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

it('binds feature card text to the preview foreground token', () => {
  render(
    <FeaturesComponent
      title="Browse products"
      features={[
        { title: 'Browse', description: 'Find products.', icon: 'search' },
      ]}
    />
  );

  expect(
    screen
      .getByRole('heading', { level: 3, name: 'Browse' })
      .closest('.text-foreground')
  ).not.toBeNull();
});
