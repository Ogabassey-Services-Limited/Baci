import { vi } from 'vitest';
import '@testing-library/jest-dom';
import React from 'react';

type MockNextImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  src?: string | { src: string };
  alt?: string;
};

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: MockNextImageProps) => {
    const normalizedSrc = typeof src === 'string' ? src : src?.src;

    // eslint-disable-next-line @next/next/no-img-element
    return React.createElement('img', { src: normalizedSrc, alt, ...props });
  },
}));
