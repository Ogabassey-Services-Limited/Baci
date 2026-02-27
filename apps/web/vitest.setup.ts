import { vi } from 'vitest';
import '@testing-library/jest-dom';
import React from 'react';

// Mock Next.js Image component for tests
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement>) => {
    return React.createElement('img', { src, alt, ...props });
  },
}));
