import { vi } from 'vitest';
import '@testing-library/jest-dom';
import React from 'react';

// Mock Next.js Image component
vi.mock('next/image', () => ({
  // biome-ignore lint/suspicious/noExplicitAny: Required for mock props
  default: ({ src, alt, ...props }: any) => {
    return React.createElement('img', { src, alt, ...props });
  },
}));
