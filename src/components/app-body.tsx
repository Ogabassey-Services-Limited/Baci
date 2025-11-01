
'use client';

import { useEffect, useState } from 'react';
import { useMerchant } from '@/hooks/use-merchant';
import { cn } from '@/lib/utils';

export default function AppBody({ children }: { children: React.ReactNode }) {
  const { loading } = useMerchant();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // To prevent flash of unstyled content, we only show the content
  // after the client has mounted and merchant data has been loaded.
  const showContent = hasMounted && !loading;

  return (
    <div
      className={cn(
        "min-h-screen bg-background font-sans antialiased transition-opacity duration-300",
        showContent ? 'opacity-100' : 'opacity-0'
      )}
    >
      {children}
    </div>
  );
}
