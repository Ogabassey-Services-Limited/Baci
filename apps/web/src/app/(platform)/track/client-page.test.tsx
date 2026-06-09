import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TrackPage from './client-page';

const mockPush = vi.fn();
const transitionMock = vi.hoisted(() => ({
  isPending: false,
  startTransition: vi.fn((callback: () => void) => callback()),
}));

vi.mock('react', async (importActual) => {
  const actual = await importActual<typeof import('react')>();
  return {
    ...actual,
    useTransition: () => [
      transitionMock.isPending,
      transitionMock.startTransition,
    ],
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

describe('TrackPage client flow', () => {
  beforeEach(() => {
    mockPush.mockClear();
    transitionMock.isPending = false;
    transitionMock.startTransition.mockClear();
    transitionMock.startTransition.mockImplementation((callback) => callback());
  });

  it('renders an accessible empty tracking form with disabled submit', () => {
    render(<TrackPage />);

    expect(screen.getByLabelText('Tracking Number')).toHaveValue('');
    expect(
      screen.getByRole('button', { name: 'Track Shipment' })
    ).toBeDisabled();
  });

  it('navigates to an encoded tracking route on submit', async () => {
    const user = userEvent.setup();
    render(<TrackPage />);

    await user.type(screen.getByLabelText('Tracking Number'), 'BAC 123/?');
    await user.click(screen.getByRole('button', { name: 'Track Shipment' }));

    expect(transitionMock.startTransition).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/track/BAC%20123%2F%3F');
  });

  it('shows the pending state from the route transition', async () => {
    transitionMock.isPending = true;
    const user = userEvent.setup();

    render(<TrackPage />);
    await user.type(screen.getByLabelText('Tracking Number'), 'BAC-123');

    expect(screen.getByRole('button', { name: 'Tracking...' })).toBeDisabled();
  });
});
