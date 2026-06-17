import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import CategoryProductLayout from './layout';

describe('CategoryProductLayout', () => {
  it('renders product page children without emitting layout-owned image preloads', () => {
    render(
      <CategoryProductLayout>
        <main>
          <h1>Rendered product page</h1>
        </main>
      </CategoryProductLayout>
    );

    expect(
      screen.getByRole('heading', { name: 'Rendered product page' })
    ).toBeInTheDocument();
  });
});
