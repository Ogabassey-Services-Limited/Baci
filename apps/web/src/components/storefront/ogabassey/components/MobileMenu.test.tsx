import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigationMocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/ogabassey',
  useRouter: () => navigationMocks,
}));

vi.mock('../providers/v2-theme-context', () => ({
  useV2Theme: () => ({ theme: {} }),
}));

vi.mock('./Logo', () => ({
  Logo: () => <span>Baci</span>,
}));

import { MobileMenu } from './MobileMenu';

describe('MobileMenu', () => {
  beforeEach(() => {
    navigationMocks.push.mockReset();
  });

  it('dismisses the open menu when Escape is pressed', () => {
    const onClose = vi.fn();

    render(<MobileMenu isOpen={true} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not attach Escape dismissal while closed', () => {
    const onClose = vi.fn();

    render(<MobileMenu isOpen={false} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });
});
