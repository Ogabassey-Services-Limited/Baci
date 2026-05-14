import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-loyalty', () => ({
  useLoyalty: () => ({ rewards: [], isLoading: false, points: 0 }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { RewardsCatalog } from './rewards-catalog';

describe('RewardsCatalog', () => {
  it('renders without crashing', () => {
    render(<RewardsCatalog merchantId="m1" customerId="c1" />);
    expect(document.body).toBeTruthy();
  });

  it('shows empty state when no rewards', () => {
    render(<RewardsCatalog merchantId="m1" customerId="c1" />);
    expect(screen.queryByRole('article')).toBeNull();
  });
});
