import type { ImageProps } from 'next/image';
import { vi } from 'vitest';
import '@testing-library/jest-dom';
import React from 'react';

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: ImageProps) => {
    const resolvedSrc = typeof src === 'string' ? src : src.src;
    // eslint-disable-next-line @next/next/no-img-element
    return React.createElement('img', { src: resolvedSrc, alt, ...props });
  },
}));
