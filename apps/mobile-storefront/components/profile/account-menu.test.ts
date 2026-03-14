import { getAccountMenuSections } from './account-menu';

describe('getAccountMenuSections', () => {
  it('includes a delete-account entry when account deletion is available', () => {
    const sections = getAccountMenuSections({
      canDeleteAccount: true,
      hasCustomerProfile: true,
    });

    const accountSection = sections.find(
      (section) => section.title === 'Account'
    );
    expect(accountSection).toBeDefined();
    const deleteAccountItem = accountSection?.items.find(
      (item) => item.id === 'delete-account'
    );

    expect(deleteAccountItem).toEqual(
      expect.objectContaining({
        label: 'Delete Account',
        route: '/profile/delete-account',
      })
    );
  });

  it('omits the delete-account entry when deletion is unavailable', () => {
    const sections = getAccountMenuSections({
      canDeleteAccount: false,
      hasCustomerProfile: true,
    });

    const allItemIds = sections.flatMap((section) =>
      section.items.map((item) => item.id)
    );

    expect(allItemIds).not.toContain('delete-account');
  });
});
