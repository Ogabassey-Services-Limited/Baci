import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OgabasseyV2Security } from './security';

describe('OgabasseyV2Security', () => {
  it('renders without crashing', () => {
    render(<OgabasseyV2Security />);
    expect(document.body).toBeTruthy();
  });

  it('shows login activity section', () => {
    render(<OgabasseyV2Security />);
    expect(screen.getByText('iPhone 15 Pro Max')).toBeTruthy();
  });
});
