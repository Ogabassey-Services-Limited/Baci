
'use client';

import { useEffect, useState } from 'react';
import { useMerchant } from '@/hooks/use-merchant';
import { cn } from '@/lib/utils';
import { getContrastingTextColor } from '@/lib/color-utils';

export default function AppBody({ children }: { children: React.ReactNode }) {
  const { merchant, loading } = useMerchant();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // To prevent flash of unstyled content, we only show the content
  // after the client has mounted and merchant data has been loaded.
  const showContent = hasMounted && !loading;

  // Define CSS variables for the merchant's theme
  const themeStyle = merchant?.colors ? {
    '--store-primary': merchant.colors.primary,
    '--store-secondary': merchant.colors.secondary,
    '--store-accent': merchant.colors.accent,
    '--store-primary-text': getContrastingTextColor(merchant.colors.primary),
    '--store-secondary-text': getContrastingTextColor(merchant.colors.secondary),
    '--store-accent-text': getContrastingTextColor(merchant.colors.accent),
  } : {};

  return (
    <div
      className={cn(
        "min-h-screen bg-background font-sans antialiased transition-opacity duration-300",
        showContent ? 'opacity-100' : 'opacity-0'
      )}
      style={themeStyle as React.CSSProperties}
    >
      {children}
    </div>
  );
}
