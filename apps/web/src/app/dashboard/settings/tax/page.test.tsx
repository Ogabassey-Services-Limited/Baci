import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ensurePermission: vi.fn(),
  isMerchantPermissionRedirectError: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('@/lib/merchant-server', () => ({
  ensurePermission: mocks.ensurePermission,
  isMerchantPermissionRedirectError: mocks.isMerchantPermissionRedirectError,
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('./tax-settings-form', async () => {
  const { useState } = await import('react');

  return {
    TaxSettingsForm: (props: Record<string, unknown>) => {
      const [draft, setDraft] = useState('');
      return (
        <div data-testid="tax-settings-form">
          {JSON.stringify(props)}
          <input
            aria-label="Tax ID draft"
            data-merchant-id={String(props.merchantId)}
            onChange={(event) => setDraft(event.target.value)}
            value={draft}
          />
        </div>
      );
    },
  };
});

import TaxSettingsPage from './page';

const merchantData = {
  country: 'NG',
  vat_registration_status: 'registered',
  vat_rate: 7.5,
  tax_identification_number: 'TIN-1',
  legal_entity_name: 'Baci Ltd',
  registered_address: {
    street: '1 Market Street',
    city: 'Lagos',
    state: 'Lagos',
    postal_code: '100001',
  },
  state_code: 'LA',
};

describe('TaxSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensurePermission.mockResolvedValue({
      merchant: { id: 'merchant-1', ...merchantData },
    });
    mocks.isMerchantPermissionRedirectError.mockReturnValue(false);
    mocks.redirect.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT');
    });
  });

  it('uses settings view access and loads tax data from the bounded context', async () => {
    render(await TaxSettingsPage());

    expect(mocks.ensurePermission).toHaveBeenCalledWith('settings', 'view');
    expect(mocks.ensurePermission).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('tax-settings-form')).toHaveTextContent('TIN-1');
    expect(screen.getByTestId('tax-settings-form')).toHaveTextContent(
      'merchant-1'
    );
  });

  it('hides Nigerian tax settings for a non-Nigerian merchant', async () => {
    mocks.ensurePermission.mockResolvedValue({
      merchant: { id: 'merchant-1', ...merchantData, country: 'IN' },
    });

    render(await TaxSettingsPage());

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Tax settings are only available for Nigerian merchants.'
    );
    expect(screen.queryByTestId('tax-settings-form')).not.toBeInTheDocument();
  });

  it('accepts settings edit access when view is denied', async () => {
    const denied = new Error('view denied');
    mocks.ensurePermission.mockRejectedValueOnce(denied).mockResolvedValueOnce({
      merchant: { id: 'merchant-1', ...merchantData },
    });
    mocks.isMerchantPermissionRedirectError.mockImplementation(
      (error) => error === denied
    );

    render(await TaxSettingsPage());

    expect(mocks.ensurePermission).toHaveBeenNthCalledWith(
      2,
      'settings',
      'edit'
    );
    expect(screen.getByTestId('tax-settings-form')).toBeInTheDocument();
  });

  it('redirects users without view or edit access', async () => {
    const denied = new Error('permission denied');
    mocks.ensurePermission.mockRejectedValue(denied);
    mocks.isMerchantPermissionRedirectError.mockReturnValue(true);

    await expect(TaxSettingsPage()).rejects.toThrow('NEXT_REDIRECT');

    expect(mocks.redirect).toHaveBeenCalledWith('/dashboard');
  });

  it('propagates unexpected permission errors', async () => {
    const outage = new Error('auth service unavailable');
    mocks.ensurePermission.mockRejectedValue(outage);

    await expect(TaxSettingsPage()).rejects.toBe(outage);

    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('propagates unexpected edit-check errors after a view denial', async () => {
    const denied = new Error('view denied');
    const outage = new Error('auth service unavailable');
    mocks.ensurePermission
      .mockRejectedValueOnce(denied)
      .mockRejectedValueOnce(outage);
    mocks.isMerchantPermissionRedirectError.mockImplementation(
      (error) => error === denied
    );

    await expect(TaxSettingsPage()).rejects.toBe(outage);

    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('remounts tax form state when the selected merchant changes', async () => {
    const user = userEvent.setup();
    mocks.ensurePermission
      .mockResolvedValueOnce({
        merchant: { id: 'merchant-a', ...merchantData },
      })
      .mockResolvedValueOnce({
        merchant: { id: 'merchant-b', ...merchantData },
      });

    const { rerender } = render(await TaxSettingsPage());
    await user.type(
      screen.getByRole('textbox', { name: 'Tax ID draft' }),
      'draft for merchant A'
    );

    rerender(await TaxSettingsPage());

    expect(
      screen.getByRole('textbox', { name: 'Tax ID draft' })
    ).toHaveAttribute('data-merchant-id', 'merchant-b');
    expect(screen.getByRole('textbox', { name: 'Tax ID draft' })).toHaveValue(
      ''
    );
  });
});
