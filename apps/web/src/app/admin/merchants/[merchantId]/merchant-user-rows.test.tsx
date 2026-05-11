import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MerchantUserRows } from './merchant-user-rows';

describe('MerchantUserRows', () => {
  it('renders users across web and app surfaces', () => {
    render(
      <MerchantUserRows
        emptyLabel="No users"
        users={[
          {
            activeAppInstallations: 1,
            appPlatforms: ['ios'],
            createdAt: '2026-03-22T09:00:00.000Z',
            email: 'staff@example.com',
            id: 'staff-1',
            lastSeenAt: '2026-03-23T10:00:00.000Z',
            name: 'Staff User',
            role: 'staff',
            staffRole: 'manager',
            status: 'active',
            surfaces: ['web', 'admin_app'],
            userId: 'staff-user',
          },
        ]}
      />
    );

    expect(screen.getByText('Staff User')).toBeVisible();
    expect(screen.getByText('staff@example.com')).toBeVisible();
    expect(screen.getByText('Staff')).toBeVisible();
    expect(screen.getByText('Manager')).toBeVisible();
    expect(screen.getByText('Web')).toBeVisible();
    expect(screen.getByText('Admin app')).toBeVisible();
    expect(screen.getByText('1 active installs')).toBeVisible();
    expect(screen.getByText('Mar 23, 2026')).toBeVisible();
  });

  it('renders the supplied empty state', () => {
    render(<MerchantUserRows emptyLabel="No staff users yet" users={[]} />);

    expect(screen.getByText('No staff users yet')).toBeVisible();
  });

  it('renders multiple users with different surfaces and app counts', () => {
    render(
      <MerchantUserRows
        emptyLabel="No users"
        users={[
          {
            activeAppInstallations: 0,
            appPlatforms: [],
            createdAt: '2026-03-22T09:00:00.000Z',
            email: 'owner@example.com',
            id: 'owner-1',
            lastSeenAt: null,
            name: 'Owner User',
            role: 'owner',
            staffRole: null,
            status: 'active',
            surfaces: ['web'],
            userId: 'owner-user',
          },
          {
            activeAppInstallations: 1,
            appPlatforms: ['android'],
            createdAt: '2026-03-23T09:00:00.000Z',
            email: null,
            id: 'app-1',
            lastSeenAt: '2026-03-24T10:00:00.000Z',
            name: null,
            role: 'app_user',
            staffRole: null,
            status: 'app_registered',
            surfaces: ['admin_app'],
            userId: 'app-user',
          },
        ]}
      />
    );

    expect(screen.getByText('Owner User')).toBeVisible();
    expect(screen.getByText('owner@example.com')).toBeVisible();
    expect(screen.getByText('App User')).toBeVisible();
    expect(screen.getByText('app-user')).toBeVisible();
    expect(screen.getByText('0 active installs')).toBeVisible();
    expect(screen.getByText('1 active installs')).toBeVisible();
    expect(screen.getByText('Never')).toBeVisible();
    expect(screen.getByText('Admin app')).toBeVisible();
    expect(screen.getByText('Web')).toBeVisible();
  });

  it('uses distinct fallbacks for missing contact fields', () => {
    render(
      <MerchantUserRows
        emptyLabel="No users"
        users={[
          {
            activeAppInstallations: 0,
            appPlatforms: [],
            createdAt: null,
            email: null,
            id: 'missing-email',
            lastSeenAt: null,
            name: 'Missing Email',
            role: 'customer',
            staffRole: null,
            status: 'active',
            surfaces: ['web'],
            userId: null,
          },
          {
            activeAppInstallations: 0,
            appPlatforms: [],
            createdAt: null,
            email: 'email-only@example.com',
            id: 'missing-id',
            lastSeenAt: null,
            name: null,
            role: 'customer',
            staffRole: null,
            status: 'active',
            surfaces: ['web'],
            userId: null,
          },
        ]}
      />
    );

    expect(screen.getByText('Missing Email')).toBeVisible();
    expect(screen.getByText('No email on file')).toBeVisible();
    expect(screen.getByText('email-only@example.com')).toBeVisible();
    expect(screen.getByText('Unknown user ID')).toBeVisible();
  });
});
