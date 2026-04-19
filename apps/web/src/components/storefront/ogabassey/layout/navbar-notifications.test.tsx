import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NavbarNotifications } from './navbar-notifications';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    prefetch: _prefetch,
    ...props
  }: {
    children: ReactNode;
    href: string;
    prefetch?: boolean;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('../components/empty-state', () => ({
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
}));

describe('NavbarNotifications', () => {
  it('toggles the notification panel and links to the account page', async () => {
    const user = userEvent.setup();

    render(<NavbarNotifications basePath="/ogabassey" />);

    await user.click(
      screen.getByRole('button', { name: /toggle notifications/i })
    );

    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('No Notifications')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View All' })).toHaveAttribute(
      'href',
      '/ogabassey/account'
    );
  });

  it('closes the notification panel when the user clicks outside', async () => {
    const user = userEvent.setup();

    render(<NavbarNotifications basePath="/ogabassey" />);

    await user.click(
      screen.getByRole('button', { name: /toggle notifications/i })
    );
    expect(screen.getByText('Notifications')).toBeInTheDocument();

    await user.click(document.body);

    expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
  });
});
