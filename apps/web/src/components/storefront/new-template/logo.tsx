'use client';

import Image from 'next/image';
import type React from 'react';
import { useMerchantSafe } from '@/hooks/use-merchant-client';

interface LogoProps {
  className?: string;
}

// Merchant brand mark for the gadgets-pro template: the merchant's uploaded
// logo when present, otherwise their business name. This template is
// merchant-generic, so it must never render platform or Ogabassey branding.
export const Logo: React.FC<LogoProps> = ({ className = 'h-8 w-auto' }) => {
  const merchant = useMerchantSafe()?.merchant;

  if (!merchant) {
    return null;
  }

  if (merchant.logo_url) {
    return (
      <Image
        src={merchant.logo_url}
        alt={`${merchant.business_name} logo`}
        width={120}
        height={40}
        className={`${className} object-contain`}
      />
    );
  }

  return (
    <span className={`text-xl font-bold tracking-tight ${className}`}>
      {merchant.business_name}
    </span>
  );
};
