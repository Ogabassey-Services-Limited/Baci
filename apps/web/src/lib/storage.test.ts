import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { createClient } from '@/lib/supabase/client';
import { uploadImage } from './storage';

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

// Mock console.error to avoid noise in test output
vi.spyOn(console, 'error').mockImplementation(() => {
  // Intentionally empty - suppress console output in tests
});

describe('uploadImage', () => {
  let mockUpload: Mock;
  let mockGetPublicUrl: Mock;
  let mockFrom: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock implementations
    mockUpload = vi.fn().mockResolvedValue({ error: null });
    mockGetPublicUrl = vi.fn().mockReturnValue({
      data: { publicUrl: 'https://example.com/storage/images/test-file.png' },
    });

    mockFrom = vi.fn(() => ({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
    }));

    (createClient as Mock).mockReturnValue({
      storage: {
        from: mockFrom,
      },
    });
  });

  describe('valid base64 data URIs', () => {
    it('uploads a valid base64 PNG data URI and returns public URL', async () => {
      // Arrange
      // 1x1 red pixel PNG (base64)
      const pngDataUri =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

      // Act
      const result = await uploadImage(pngDataUri);

      // Assert
      expect(mockFrom).toHaveBeenCalledWith('images');
      expect(mockUpload).toHaveBeenCalledTimes(1);
      const uploadCall = mockUpload.mock.calls[0];
      expect(uploadCall[0]).toMatch(/^\d+-[a-z0-9-]+\.png$/); // fileName with exact length
      expect(uploadCall[1]).toBeInstanceOf(Blob);
      expect(uploadCall[1].type).toBe('image/png');
      expect(mockGetPublicUrl).toHaveBeenCalledWith(uploadCall[0]);
      expect(result).toBe('https://example.com/storage/images/test-file.png');
    });

    it('uploads a valid SVG data URI and uses .svg extension', async () => {
      // Arrange
      const svgDataUri =
        'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0MCIgZmlsbD0icmVkIi8+PC9zdmc+';

      // Act
      const result = await uploadImage(svgDataUri);

      // Assert
      expect(mockUpload).toHaveBeenCalledTimes(1);
      const uploadCall = mockUpload.mock.calls[0];
      expect(uploadCall[0]).toMatch(/^\d+-[a-z0-9-]+\.svg$/); // .svg extension
      expect(uploadCall[1]).toBeInstanceOf(Blob);
      expect(uploadCall[1].type).toBe('image/svg+xml');
      expect(result).toBe('https://example.com/storage/images/test-file.png');
    });

    it('uploads a valid JPEG data URI and uses .jpeg extension', async () => {
      // Arrange
      // Minimal JPEG base64 (valid JPEG header)
      const jpegDataUri =
        'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP/bAEMA/8QA';

      // Act
      const result = await uploadImage(jpegDataUri);

      // Assert
      expect(mockUpload).toHaveBeenCalledTimes(1);
      const uploadCall = mockUpload.mock.calls[0];
      expect(uploadCall[0]).toMatch(/^\d+-[a-z0-9-]+\.jpeg$/); // .jpeg extension
      expect(uploadCall[1]).toBeInstanceOf(Blob);
      expect(uploadCall[1].type).toBe('image/jpeg');
      expect(result).toBe('https://example.com/storage/images/test-file.png');
    });
  });

  describe('custom bucket', () => {
    it('uploads to a custom bucket when specified', async () => {
      // Arrange
      const pngDataUri =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
      const customBucket = 'custom-bucket';

      // Act
      const result = await uploadImage(pngDataUri, customBucket);

      // Assert
      expect(mockFrom).toHaveBeenCalledWith(customBucket);
      expect(mockUpload).toHaveBeenCalledTimes(1);
      expect(result).toBe('https://example.com/storage/images/test-file.png');
    });
  });

  describe('blob: URIs', () => {
    it('fetches and uploads a blob: URI', async () => {
      // Arrange
      const blobUri = 'blob:http://localhost:3000/some-blob-id';
      const mockBlob = new Blob(['fake image data'], { type: 'image/png' });
      const mockFetch = vi.fn().mockResolvedValue({
        blob: vi.fn().mockResolvedValue(mockBlob),
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      // Act
      const result = await uploadImage(blobUri);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(blobUri);
      expect(mockUpload).toHaveBeenCalledTimes(1);
      const uploadCall = mockUpload.mock.calls[0];
      expect(uploadCall[1]).toBe(mockBlob);
      expect(result).toBe('https://example.com/storage/images/test-file.png');
    });
  });

  describe('invalid data URIs', () => {
    it('rejects non-image data URIs', async () => {
      // Arrange
      const textDataUri = 'data:text/plain;base64,SGVsbG8gV29ybGQ=';

      // Act & Assert
      await expect(uploadImage(textDataUri)).rejects.toThrow(
        'Invalid URI. Only data:image/* and blob: URIs are allowed.'
      );
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('rejects malformed data URI format', async () => {
      // Arrange
      const malformedUri = 'not-a-valid-uri';

      // Act & Assert
      await expect(uploadImage(malformedUri)).rejects.toThrow(
        'Invalid URI. Only data:image/* and blob: URIs are allowed.'
      );
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('rejects data URI without data:image/ prefix', async () => {
      // Arrange
      const invalidUri = 'data:application/json;base64,e30=';

      // Act & Assert
      await expect(uploadImage(invalidUri)).rejects.toThrow(
        'Invalid URI. Only data:image/* and blob: URIs are allowed.'
      );
      expect(mockUpload).not.toHaveBeenCalled();
    });
  });

  describe('SSRF prevention', () => {
    it('rejects http:// URIs to prevent SSRF', async () => {
      // Arrange
      const httpUri = 'http://example.com/image.png';

      // Act & Assert
      await expect(uploadImage(httpUri)).rejects.toThrow(
        'Invalid URI. Only data:image/* and blob: URIs are allowed.'
      );
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('rejects https:// URIs to prevent SSRF', async () => {
      // Arrange
      const httpsUri = 'https://example.com/image.png';

      // Act & Assert
      await expect(uploadImage(httpsUri)).rejects.toThrow(
        'Invalid URI. Only data:image/* and blob: URIs are allowed.'
      );
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('rejects file:// URIs', async () => {
      // Arrange
      const fileUri = 'file:///etc/passwd';

      // Act & Assert
      await expect(uploadImage(fileUri)).rejects.toThrow(
        'Invalid URI. Only data:image/* and blob: URIs are allowed.'
      );
      expect(mockUpload).not.toHaveBeenCalled();
    });
  });

  describe('Supabase upload errors', () => {
    it('throws when Supabase upload fails', async () => {
      // Arrange
      const pngDataUri =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
      const uploadError = {
        message: 'Storage quota exceeded',
        code: 'STORAGE_QUOTA_EXCEEDED',
      };
      mockUpload.mockResolvedValue({ error: uploadError });

      // Act & Assert
      await expect(uploadImage(pngDataUri)).rejects.toEqual(uploadError);
      expect(mockUpload).toHaveBeenCalledTimes(1);
      expect(mockGetPublicUrl).not.toHaveBeenCalled();
    });

    it('throws when Supabase upload fails with network error', async () => {
      // Arrange
      const pngDataUri =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
      const uploadError = { message: 'Network error', code: 'NETWORK_ERROR' };
      mockUpload.mockResolvedValue({ error: uploadError });

      // Act & Assert
      await expect(uploadImage(pngDataUri)).rejects.toEqual(uploadError);
      expect(mockUpload).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('handles data URI without explicit MIME type (defaults to application/octet-stream)', async () => {
      // Arrange
      // This should be rejected because default MIME is not image/*
      const noMimeUri = 'data:;base64,SGVsbG8=';

      // Act & Assert
      await expect(uploadImage(noMimeUri)).rejects.toThrow(
        'Invalid URI. Only data:image/* and blob: URIs are allowed.'
      );
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('handles non-base64 data URI (URL-encoded)', async () => {
      // Arrange
      // SVG without base64 encoding
      const urlEncodedUri =
        'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3C%2Fsvg%3E';

      // Act
      const result = await uploadImage(urlEncodedUri);

      // Assert
      expect(mockUpload).toHaveBeenCalledTimes(1);
      const uploadCall = mockUpload.mock.calls[0];
      expect(uploadCall[1]).toBeInstanceOf(Blob);
      expect(uploadCall[1].type).toBe('image/svg+xml');
      expect(result).toBe('https://example.com/storage/images/test-file.png');
    });

    it('generates unique filenames with timestamp and random component', async () => {
      // Arrange
      const pngDataUri =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

      // Act
      await uploadImage(pngDataUri);
      await uploadImage(pngDataUri);

      // Assert
      expect(mockUpload).toHaveBeenCalledTimes(2);
      const fileName1 = mockUpload.mock.calls[0][0] as string;
      const fileName2 = mockUpload.mock.calls[1][0] as string;
      expect(fileName1).not.toBe(fileName2); // Should be unique
      expect(fileName1).toMatch(/^\d+-[a-z0-9-]+\.png$/);
      expect(fileName2).toMatch(/^\d+-[a-z0-9-]+\.png$/);
    });

    it('handles empty data URI data segment', async () => {
      // Arrange
      const emptyDataUri = 'data:image/png;base64,';

      // Act
      const result = await uploadImage(emptyDataUri);

      // Assert
      expect(mockUpload).toHaveBeenCalledTimes(1);
      const uploadCall = mockUpload.mock.calls[0];
      expect(uploadCall[1]).toBeInstanceOf(Blob);
      expect(uploadCall[1].size).toBe(0); // Empty blob
      expect(result).toBe('https://example.com/storage/images/test-file.png');
    });
  });
});
