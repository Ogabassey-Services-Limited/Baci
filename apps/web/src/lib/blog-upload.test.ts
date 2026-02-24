import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_BLOG_IMAGE_SIZE } from '@/schemas/blog-upload';

const mockGetSignedUploadUrl = vi.fn();
const mockUploadToSignedUrl = vi.fn();

vi.mock('@/actions/blog-upload', () => ({
  getSignedUploadUrl: (...args: unknown[]) => mockGetSignedUploadUrl(...args),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        uploadToSignedUrl: mockUploadToSignedUrl,
      })),
    },
  })),
}));

const { uploadBlogImage } = await import('@/lib/blog-upload');

function createMockFile(name: string, size: number, type: string): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

describe('uploadBlogImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSignedUploadUrl.mockResolvedValue({
      token: 'test-token',
      path: 'merchant-1/blog/abc123.jpg',
      publicUrl: 'https://storage.example.com/media/merchant-1/blog/abc123.jpg',
    });
    mockUploadToSignedUrl.mockResolvedValue({ error: null });
  });

  it('uploads a valid JPEG file successfully', async () => {
    const file = createMockFile('photo.jpg', 1024, 'image/jpeg');

    const result = await uploadBlogImage(file);

    expect(result).toEqual({
      url: 'https://storage.example.com/media/merchant-1/blog/abc123.jpg',
      path: 'merchant-1/blog/abc123.jpg',
    });
  });

  it('calls getSignedUploadUrl with file metadata', async () => {
    const file = createMockFile('test.png', 2048, 'image/png');

    await uploadBlogImage(file);

    expect(mockGetSignedUploadUrl).toHaveBeenCalledWith({
      contentType: 'image/png',
      fileSize: 2048,
    });
  });

  it('calls uploadToSignedUrl with correct params', async () => {
    const file = createMockFile('photo.jpg', 1024, 'image/jpeg');

    await uploadBlogImage(file);

    expect(mockUploadToSignedUrl).toHaveBeenCalledWith(
      'merchant-1/blog/abc123.jpg',
      'test-token',
      file,
      { contentType: 'image/jpeg', cacheControl: '31536000' }
    );
  });

  it('throws for invalid file type', async () => {
    const file = createMockFile('doc.pdf', 1024, 'application/pdf');

    await expect(uploadBlogImage(file)).rejects.toThrow('Invalid file type');
    expect(mockGetSignedUploadUrl).not.toHaveBeenCalled();
  });

  it('throws for oversized file', async () => {
    const file = createMockFile(
      'huge.jpg',
      MAX_BLOG_IMAGE_SIZE + 1,
      'image/jpeg'
    );

    await expect(uploadBlogImage(file)).rejects.toThrow('File too large');
    expect(mockGetSignedUploadUrl).not.toHaveBeenCalled();
  });

  it('throws when server action returns error', async () => {
    mockGetSignedUploadUrl.mockResolvedValue({
      error: 'Permission denied',
    });
    const file = createMockFile('photo.jpg', 1024, 'image/jpeg');

    await expect(uploadBlogImage(file)).rejects.toThrow('Permission denied');
  });

  it('throws when storage upload fails', async () => {
    mockUploadToSignedUrl.mockResolvedValue({
      error: { message: 'Upload failed' },
    });
    const file = createMockFile('photo.jpg', 1024, 'image/jpeg');

    await expect(uploadBlogImage(file)).rejects.toThrow(
      'Failed to upload image'
    );
  });

  it.each([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
  ])('accepts %s', async (type) => {
    const file = createMockFile('test', 1024, type);
    const result = await uploadBlogImage(file);
    expect(result.url).toBeDefined();
  });
});
