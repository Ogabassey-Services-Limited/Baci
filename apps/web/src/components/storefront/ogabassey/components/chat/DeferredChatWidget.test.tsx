import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/ogabassey'),
}));

vi.mock('@/hooks/cart', () => ({
  useCart: vi.fn(() => ({
    isCartOpen: false,
  })),
}));

vi.mock('../../providers/v2-theme-context', () => ({
  useV2Theme: vi.fn(() => ({
    theme: 'standard',
  })),
}));

import { DeferredChatWidget } from './DeferredChatWidget';

describe('DeferredChatWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the launcher immediately without loading the chat runtime', () => {
    const loadChatWidget = vi.fn().mockResolvedValue({
      ChatWidget: () => <div>Loaded chat runtime</div>,
    });

    render(<DeferredChatWidget loadChatWidget={loadChatWidget} />);

    expect(
      screen.getByRole('button', { name: 'Open chat assistant' })
    ).toBeInTheDocument();
    expect(loadChatWidget).not.toHaveBeenCalled();
    expect(screen.queryByText('Loaded chat runtime')).not.toBeInTheDocument();
  });

  it('loads the chat runtime only after the launcher is clicked', async () => {
    const loadChatWidget = vi.fn().mockResolvedValue({
      ChatWidget: ({ openOnMount }: { openOnMount?: boolean }) => (
        <div>{openOnMount ? 'Loaded chat runtime open' : 'Loaded chat runtime'}</div>
      ),
    });

    const user = userEvent.setup();
    render(<DeferredChatWidget loadChatWidget={loadChatWidget} />);

    await user.click(
      screen.getByRole('button', { name: 'Open chat assistant' })
    );

    expect(loadChatWidget).toHaveBeenCalledOnce();
    expect(
      await screen.findByText('Loaded chat runtime open')
    ).toBeInTheDocument();
  });
});
