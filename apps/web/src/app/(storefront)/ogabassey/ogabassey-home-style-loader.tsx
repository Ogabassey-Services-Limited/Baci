'use client';

import { useEffect, useRef } from 'react';

type OgabasseyHomeStyleLoaderProps = {
  loadStyles?: () => Promise<unknown>;
};

function loadDefaultHomeStyles() {
  return import('@/app/(storefront)/storefront-home.css');
}

export function OgabasseyHomeStyleLoader({
  loadStyles = loadDefaultHomeStyles,
}: OgabasseyHomeStyleLoaderProps = {}) {
  const loadStylesRef = useRef(loadStyles);

  useEffect(() => {
    loadStylesRef.current().catch((error: unknown) => {
      console.error('Failed to load OgaBassey homepage stylesheet', error);
    });
  }, []);

  return null;
}
