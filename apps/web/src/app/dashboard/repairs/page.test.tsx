import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ensurePermission, createClient, cookies } = vi.hoisted(() => ({
  ensurePermission: vi.fn(),
  createClient: vi.fn(),
  cookies: vi.fn(),
}));

vi.mock('@/lib/merchant-server', () => ({ ensurePermission }));
vi.mock('@/lib/supabase/server', () => ({ createClient }));
vi.mock('next/headers', () => ({ cookies }));
vi.mock('./repairs-catalog-client', () => ({
  default: ({ catalogEnabled }: { catalogEnabled: boolean }) => (
    <div>catalog-client:{String(catalogEnabled)}</div>
  ),
}));
vi.mock('./repairs-unavailable', () => ({
  default: ({ reason }: { reason: string }) => <div>unavailable:{reason}</div>,
}));

import RepairsPage from './page';

function supabaseReturning(enabled: boolean | null) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: enabled === null ? null : { repairs_catalog_enabled: enabled },
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from };
}

function permissionResult(businessType: string) {
  return {
    merchant: { id: 'm-1', business_type: businessType },
    staffAccess: {
      isOwner: true,
      permissions: {},
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  cookies.mockResolvedValue({});
});

describe('RepairsPage gating', () => {
  it('shows the permission empty state when access is denied', async () => {
    ensurePermission.mockRejectedValue(new Error('denied'));
    render(await RepairsPage());
    expect(screen.getByText('unavailable:permission')).toBeInTheDocument();
  });

  it('shows the business-type empty state for a non-electronics store', async () => {
    ensurePermission.mockResolvedValue(permissionResult('fashion'));
    render(await RepairsPage());
    expect(screen.getByText('unavailable:business-type')).toBeInTheDocument();
  });

  it('keeps bookings available when the catalogue flag is off', async () => {
    ensurePermission.mockResolvedValue(permissionResult('electronics'));
    createClient.mockReturnValue(supabaseReturning(false));
    render(await RepairsPage());
    expect(screen.getByText('catalog-client:false')).toBeInTheDocument();
  });

  it('renders the catalogue when enabled for an electronics store', async () => {
    ensurePermission.mockResolvedValue(permissionResult('electronics'));
    createClient.mockReturnValue(supabaseReturning(true));
    render(await RepairsPage());
    expect(screen.getByText('catalog-client:true')).toBeInTheDocument();
  });
});
