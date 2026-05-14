import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MobileMenu } from './mobile-menu';

describe('MobileMenu', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<MobileMenu isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders menu content when open', () => {
    render(<MobileMenu isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Menu')).toBeTruthy();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    render(<MobileMenu isOpen={true} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
