import { vi } from 'vitest';
import '@testing-library/jest-dom';
import React from 'react';

type MockImageSrc = string | { src: string } | { default: { src: string } };

type MockNextImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  src?: MockImageSrc;
  alt?: string;
};

async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.stream === 'function') {
    const reader = blob.stream().getReader();
    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (value) {
        chunks.push(value);
        totalLength += value.byteLength;
      }
    }

    const bytes = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return bytes.buffer;
  }

  if (typeof FileReader !== 'undefined') {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => {
        reject(reader.error ?? new Error('Failed to read blob'));
      };

      reader.onload = () => {
        const result = reader.result;

        if (result instanceof ArrayBuffer) {
          resolve(result);
          return;
        }

        reject(new Error('Unexpected FileReader result'));
      };

      reader.readAsArrayBuffer(blob);
    });
  }

  return new TextEncoder().encode(await blob.text()).buffer;
}

if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
  Object.defineProperty(Blob.prototype, 'arrayBuffer', {
    configurable: true,
    writable: true,
    value: function arrayBuffer(this: Blob) {
      return blobToArrayBuffer(this);
    },
  });
}

if (typeof File !== 'undefined' && !File.prototype.arrayBuffer) {
  Object.defineProperty(File.prototype, 'arrayBuffer', {
    configurable: true,
    writable: true,
    value: function arrayBuffer(this: File) {
      return blobToArrayBuffer(this);
    },
  });
}

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: MockNextImageProps) => {
    const normalizedSrc =
      typeof src === 'string'
        ? src
        : src && 'default' in src
          ? src.default.src
          : src?.src;

    // eslint-disable-next-line @next/next/no-img-element
    return React.createElement('img', { src: normalizedSrc, alt, ...props });
  },
}));
