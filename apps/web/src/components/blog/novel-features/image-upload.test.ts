import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_BLOG_IMAGE_SIZE,
  MAX_BLOG_IMAGE_SIZE_LABEL,
} from '@/schemas/blog-upload';

const mockUploadBlogImage = vi.fn();
const mockToast = vi.fn();

vi.mock('@/lib/blog-upload', () => ({
  uploadBlogImage: (...args: unknown[]) => mockUploadBlogImage(...args),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

// Capture the config passed to createImageUpload at module load time
let capturedConfig: {
  onUpload: (file: File) => Promise<string>;
  validateFn: (file: File) => boolean;
} | null = null;

vi.mock('novel', () => ({
  createImageUpload: (config: typeof capturedConfig) => {
    capturedConfig = config;
    return config;
  },
}));

// Import triggers module-level createImageUpload call
await import('./image-upload');

// Non-nullable reference assigned in beforeEach
let config: {
  onUpload: (file: File) => Promise<string>;
  validateFn: (file: File) => boolean;
};

describe('image-upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (!capturedConfig) throw new Error('capturedConfig not populated');
    config = capturedConfig;
  });

  describe('uploadFn configuration', () => {
    it('passes onUpload and validateFn to createImageUpload', () => {
      expect(config).toHaveProperty('onUpload');
      expect(config).toHaveProperty('validateFn');
    });
  });

  describe('validateFn', () => {
    function createMockFile(type: string, sizeBytes: number): File {
      const buffer = new ArrayBuffer(sizeBytes);
      return new File([buffer], 'test', { type });
    }

    it('accepts valid image types', () => {
      const validTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/avif',
      ];
      for (const type of validTypes) {
        expect(config.validateFn(createMockFile(type, 1024))).toBe(true);
      }
    });

    it('rejects non-image file types', () => {
      const file = createMockFile('application/pdf', 1024);

      expect(config.validateFn(file)).toBe(false);
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          variant: 'destructive',
        })
      );
    });

    it('rejects oversized files', () => {
      const file = createMockFile('image/jpeg', MAX_BLOG_IMAGE_SIZE + 1);

      expect(config.validateFn(file)).toBe(false);
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining(MAX_BLOG_IMAGE_SIZE_LABEL),
        })
      );
    });

    it('accepts files at exact max size', () => {
      const file = createMockFile('image/jpeg', MAX_BLOG_IMAGE_SIZE);

      expect(config.validateFn(file)).toBe(true);
    });
  });

  describe('onUpload', () => {
    it('shows uploading toast and calls uploadBlogImage', async () => {
      const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });

      mockUploadBlogImage.mockResolvedValue({
        url: 'https://example.com/image.jpg',
        path: 'merchant/blog/image.jpg',
      });

      // Mock Image for preloading
      const origImage = globalThis.Image;
      class MockImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        private _src = '';
        get src() {
          return this._src;
        }
        set src(val: string) {
          this._src = val;
          // Simulate image load
          queueMicrotask(() => this.onload?.());
        }
      }
      globalThis.Image = MockImage as unknown as typeof globalThis.Image;

      try {
        const resultUrl = await config.onUpload(file);

        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Uploading image...' })
        );
        expect(mockUploadBlogImage).toHaveBeenCalledWith(file);
        expect(resultUrl).toBe('https://example.com/image.jpg');
      } finally {
        globalThis.Image = origImage;
      }
    });
  });
});
