import { describe, expect, it, vi } from 'vitest';
import { createMenuSections } from './menu-sections';

function createOptions(
  overrides: Partial<Parameters<typeof createMenuSections>[0]> = {}
) {
  return {
    canCreateExpenses: false,
    canViewExpenses: true,
    destructiveColor: '#dc2626',
    isNigerianMerchant: true,
    onFeaturePress: vi.fn(),
    onLogout: vi.fn(),
    onNavigate: vi.fn(),
    proBadge: vi.fn(() => undefined),
    ...overrides,
  };
}

describe('createMenuSections', () => {
  it('includes Expenses in Business only when the caller can view expenses', () => {
    const visibleOptions = createOptions();
    const visibleBusiness = createMenuSections(visibleOptions).find(
      (section) => section.title === 'Business'
    );
    const hiddenBusiness = createMenuSections(
      createOptions({ canViewExpenses: false })
    ).find((section) => section.title === 'Business');

    expect(visibleBusiness?.items.map((item) => item.id)).toContain('expenses');
    expect(hiddenBusiness?.items.map((item) => item.id)).not.toContain(
      'expenses'
    );
  });

  it('keeps a create-only Expenses entry pointed at the add screen', () => {
    const options = createOptions({
      canCreateExpenses: true,
      canViewExpenses: false,
    });
    const expense = createMenuSections(options)
      .find((section) => section.title === 'Business')
      ?.items.find((item) => item.id === 'expenses');

    expense?.onPress();

    expect(options.onNavigate).toHaveBeenCalledWith('/expenses/new');
  });

  it('delegates a locked-feature row through the supplied feature handler', () => {
    const options = createOptions();
    const marketplace = createMenuSections(options)[0]?.items.find(
      (item) => item.id === 'marketplaces'
    );

    marketplace?.onPress();

    expect(options.onFeaturePress).toHaveBeenCalledWith(
      'marketplace_sync',
      'Marketplaces',
      '/sales-channels'
    );
  });

  it('includes the account and business settings available after onboarding', () => {
    const sections = createMenuSections(createOptions());
    const store = sections.find((section) => section.title === 'Store');
    const business = sections.find((section) => section.title === 'Business');
    const account = sections.find((section) => section.title === 'Account');

    expect(store?.items.map((item) => item.id)).toContain('payout-settings');
    expect(business?.items.map((item) => item.id)).toContain('email-domain');
    expect(account?.items.map((item) => item.id)).toEqual(
      expect.arrayContaining(['kyc', 'security'])
    );
  });

  it('only exposes identity verification to Nigerian merchants', () => {
    const account = createMenuSections(
      createOptions({ isNigerianMerchant: false })
    ).find((section) => section.title === 'Account');

    expect(account?.items.map((item) => item.id)).not.toContain('kyc');
  });

  it('routes payout settings through the shared navigation callback', () => {
    const options = createOptions();
    const payoutSettings = createMenuSections(options)
      .find((section) => section.title === 'Store')
      ?.items.find((item) => item.id === 'payout-settings');

    payoutSettings?.onPress();

    expect(options.onNavigate).toHaveBeenCalledWith('/payout-settings');
  });
});
