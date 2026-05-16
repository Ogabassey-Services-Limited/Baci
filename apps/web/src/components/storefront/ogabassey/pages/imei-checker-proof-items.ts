import { BadgeCheck, Lock, ShieldAlert } from 'lucide-react';

export const IMEI_CHECKER_PROOF_ITEMS = [
  {
    body: "Don't become an accomplice. Stolen phones get blacklisted and become worthless. Check before you pay.",
    icon: ShieldAlert,
    title: '1 in 5 Used Phones Are Stolen',
  },
  {
    body: "If Find My iPhone is ON, you can't use the phone. Period. Sellers hide this. We expose it.",
    icon: Lock,
    title: 'iCloud Lock = Expensive Paperweight',
  },
  {
    body: 'Refurbished phones sold as new is rampant. Our check reveals when the device was actually activated.',
    icon: BadgeCheck,
    title: '"Brand New" Often Isn\'t',
  },
];
