'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { setGoogleAdManagerPath } from './google-ad-bootstrap';

export const GoogleAdManager = () => {
  const pathname = usePathname();

  useEffect(() => {
    setGoogleAdManagerPath(pathname);
  }, [pathname]);

  return null;
};
