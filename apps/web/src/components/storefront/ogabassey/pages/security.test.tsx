import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OgabasseyV2Security } from './security';

describe('OgabasseyV2Security', () => {
  it('renders without crashing', () => {
    render(<OgabasseyV2Security />);
    expect(document.body).toBeTruthy();
  });

  it('shows login activity section', () => {
    render(<OgabasseyV2Security />);
    const loginActivity = screen.getByRole('list', {
      name: /login activity/i,
    });

    expect(
      screen.getByRole('heading', { name: /where you're logged in/i })
    ).toBeInTheDocument();
    expect(within(loginActivity).getAllByRole('listitem').length).toBeGreaterThan(
      0
    );
  });
});
