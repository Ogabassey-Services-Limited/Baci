import {
  BadgeCheck,
  Globe,
  ShieldAlert,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

export const SERVICE_TIERS = {
  full: {
    id: 'full',
    name: 'Full Report',
    tagline: 'Know everything',
    price: 1500,
    priceDisplay: '₦1,500',
    features: [
      'Device Model',
      'iCloud Status',
      'Blacklist Check',
      'Carrier Info',
      'SIM Lock',
      'Trust Score',
    ],
    icon: BadgeCheck,
    color: 'green',
    recommended: true,
  },
  activation: {
    id: 'activation',
    name: 'Activation Check',
    tagline: 'Is it actually brand new?',
    price: 700,
    priceDisplay: '₦700',
    features: [
      'Activation Status',
      'Purchase Date',
      'Warranty Status',
      'Model / Serial',
    ],
    icon: Sparkles,
    color: 'purple',
  },
  blacklist: {
    id: 'blacklist',
    name: 'Stolen Check',
    tagline: 'Is it reported stolen?',
    price: 700,
    priceDisplay: '₦700',
    features: ['Device Model', 'Blacklist Status', 'GSMA Database'],
    icon: ShieldAlert,
    color: 'orange',
  },
  carrier: {
    id: 'carrier',
    name: 'Network Check',
    tagline: 'Will my SIM work?',
    price: 1000,
    priceDisplay: '₦1,000',
    features: ['Device Model', 'Original Carrier', 'Network Info'],
    icon: Globe,
    color: 'blue',
  },
} as const satisfies Record<
  string,
  {
    id: string;
    name: string;
    tagline: string;
    price: number;
    priceDisplay: string;
    features: readonly string[];
    icon: LucideIcon;
    color: string;
    recommended?: boolean;
  }
>;

export type ServiceTier = keyof typeof SERVICE_TIERS;
