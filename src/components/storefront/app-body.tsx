'use client';

import React from 'react';
import type { MerchantData } from '@/hooks/use-merchant';

interface AppBodyProps {
  children: React.ReactNode;
  font?: string;
  merchant?: MerchantData;
}

export const AppBody: React.FC<AppBodyProps> = ({ children, font, merchant }) => {
  // Apply custom font if provided
  const fontClass = font ? `font-${font}` : 'font-sans';

  return (
    <div
      className={`w-full min-h-screen bg-white ${fontClass} text-gray-900 relative`}
      data-merchant={merchant?.slug}
    >
      {children}
    </div>
  );
};
