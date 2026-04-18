import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/test-store'),
}));
vi.mock('@/hooks/cart', () => ({
  useCart: vi.fn(() => ({ items: [], totalItems: 0, addToCart: vi.fn() })),
}));
vi.mock('@/components/storefront/santa-chat/types', () => ({
  parseCartAction: vi.fn(() => null),
}));
vi.mock('../providers/v2-theme-context', () => ({
  useV2Theme: vi.fn(() => ({
    colors: { primary: '#000', accent: '#fff', background: '#fff' },
  })),
}));

import { ChatWidget } from './ChatWidget';

describe('ChatWidget', () => {
  it('renders without crashing', () => {
    const { container } = render(<ChatWidget />);
    expect(container).toBeDefined();
  });
});
