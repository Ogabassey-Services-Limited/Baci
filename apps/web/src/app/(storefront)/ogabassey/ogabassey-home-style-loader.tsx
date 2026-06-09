'use client';

import { useEffect } from 'react';

function loadOgabasseyHomeStyles() {
  return import('@/app/(storefront)/storefront-home.css');
}

export function OgabasseyHomeStyleLoader() {
  useEffect(() => {
    loadOgabasseyHomeStyles().catch((error: unknown) => {
      console.error(
        new Error('Failed to load OgaBassey homepage stylesheet', {
          cause: error,
        })
      );
    });
  }, []);

  return null;
}
