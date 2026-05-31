import type { UtilityRepeatRecipient } from '@/lib/utility-repeat';

export const MOCK_RECENT_RECIPIENTS: UtilityRepeatRecipient[] = [
  {
    id: 'mock-1',
    title: 'Bassey John',
    identifierLabel: 'Phone Number',
    identifier: '09039739318',
    meta: '₦10,000',
    defaults: {
      amount: '10000',
      phoneNumber: '09039739318',
      isVerified: true,
    },
  },
  {
    id: 'mock-2',
    title: 'Bassey John',
    identifierLabel: 'Phone Number',
    identifier: '09169449282',
    meta: '₦1,000',
    defaults: {
      amount: '1000',
      phoneNumber: '09169449282',
      isVerified: true,
    },
  },
];
