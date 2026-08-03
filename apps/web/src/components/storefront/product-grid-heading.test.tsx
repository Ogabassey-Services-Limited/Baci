import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { ProductGridHeading } from './product-grid-heading';

it('uses the derived foreground token rather than a merchant color heuristic', () => {
  render(<ProductGridHeading title="Explore products" />);

  expect(screen.getByRole('heading', { name: 'Explore products' })).toHaveClass(
    'text-foreground'
  );
});
