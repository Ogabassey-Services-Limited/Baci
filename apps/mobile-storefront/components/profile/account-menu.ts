import { palette } from '@/constants/Colors';
import type { MenuItem } from './MenuSection';

export interface AccountMenuSection {
  title: string;
  items: MenuItem[];
  visible: boolean;
}

interface AccountMenuOptions {
  canDeleteAccount: boolean;
  hasCustomerProfile: boolean;
}

export function getAccountMenuSections({
  canDeleteAccount,
  hasCustomerProfile,
}: AccountMenuOptions): AccountMenuSection[] {
  return [
    {
      title: 'Activities',
      items: [
        {
          id: 'orders',
          icon: 'receipt-outline',
          label: 'My Orders',
          subLabel: 'Track, return, or buy again',
          route: '/orders',
          color: palette.red[500],
        },
        {
          id: 'receipts',
          icon: 'document-text-outline',
          label: 'Receipts & Invoices',
          subLabel: 'View and download payment records',
          route: '/receipts',
          color: '#059669',
        },
        {
          id: 'saved',
          icon: 'heart-outline',
          label: 'Saved Items',
          subLabel: 'Your wishlisted products',
          route: '/saved',
          color: palette.red[500],
        },
        {
          id: 'wallet',
          icon: 'wallet-outline',
          label: 'Wallet & Rewards',
          subLabel: 'Manage balance and points',
          route: '/wallet',
          color: palette.amber[500],
        },
      ],
      visible: hasCustomerProfile,
    },
    {
      title: 'Personal Info',
      items: [
        {
          id: 'addresses',
          icon: 'location-outline',
          label: 'Shipping Addresses',
          subLabel: 'Manage your delivery locations',
          route: '/addresses',
          color: palette.gray[600],
        },
        {
          id: 'notifications',
          icon: 'notifications-outline',
          label: 'Notifications',
          subLabel: 'Manage alerts and messages',
          route: '/notifications',
          color: palette.amber[500],
        },
      ],
      visible: hasCustomerProfile,
    },
    {
      title: 'Account',
      items: [
        {
          id: 'settings',
          icon: 'settings-outline',
          label: 'App Settings',
          subLabel: 'Themes, notifications, and more',
          route: '/settings',
          color: palette.gray[500],
        },
        ...(canDeleteAccount
          ? [
              {
                id: 'delete-account',
                icon: 'trash-outline',
                label: 'Delete Account',
                subLabel: 'Permanently remove your account from the app',
                route: '/profile/delete-account',
                color: palette.red[600],
              } satisfies MenuItem,
            ]
          : []),
      ],
      visible: true,
    },
    {
      title: 'Support & Help',
      items: [
        {
          id: 'help',
          icon: 'help-circle-outline',
          label: 'Help Center',
          subLabel: 'FAQs, chat, and support',
          route: '/faq',
          color: '#3B82F6',
        },
        {
          id: 'repairs',
          icon: 'build-outline',
          label: 'Repairs & Services',
          subLabel: 'Device repair and restoration',
          route: '/repairs',
          color: palette.gray[600],
        },
      ],
      visible: true,
    },
  ];
}
