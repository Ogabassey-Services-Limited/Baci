import { describe, expect, it } from 'vitest';
import {
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_IMAGE_TYPES,
  MAX_BLOG_IMAGE_SIZE,
  MAX_BLOG_IMAGE_SIZE_LABEL,
  MIME_TO_EXT,
  signedUrlRequestSchema,
} from '@/schemas/blog-upload';

describe('blog-upload constants', () => {
  it('MAX_BLOG_IMAGE_SIZE is 10MB', () => {
    expect(MAX_BLOG_IMAGE_SIZE).toBe(10 * 1024 * 1024);
  });

  it('MAX_BLOG_IMAGE_SIZE_LABEL is human readable', () => {
    expect(MAX_BLOG_IMAGE_SIZE_LABEL).toBe('10MB');
  });

  it('ALLOWED_IMAGE_TYPES includes all expected types', () => {
    expect(ALLOWED_IMAGE_TYPES).toContain('image/jpeg');
    expect(ALLOWED_IMAGE_TYPES).toContain('image/png');
    expect(ALLOWED_IMAGE_TYPES).toContain('image/gif');
    expect(ALLOWED_IMAGE_TYPES).toContain('image/webp');
    expect(ALLOWED_IMAGE_TYPES).toContain('image/avif');
    expect(ALLOWED_IMAGE_TYPES).toHaveLength(5);
  });

  it('MIME_TO_EXT maps all allowed types', () => {
    for (const type of ALLOWED_IMAGE_TYPES) {
      expect(MIME_TO_EXT[type]).toBeDefined();
    }
    expect(MIME_TO_EXT['image/jpeg']).toBe('jpg');
    expect(MIME_TO_EXT['image/png']).toBe('png');
  });

  it('ALLOWED_IMAGE_EXTENSIONS includes common formats', () => {
    expect(ALLOWED_IMAGE_EXTENSIONS).toContain('.jpg');
    expect(ALLOWED_IMAGE_EXTENSIONS).toContain('.jpeg');
    expect(ALLOWED_IMAGE_EXTENSIONS).toContain('.png');
    expect(ALLOWED_IMAGE_EXTENSIONS).toContain('.webp');
  });
});

describe('signedUrlRequestSchema', () => {
  const validInput = {
    contentType: 'image/jpeg' as const,
    fileSize: 1024,
  };

  it('parses valid input', () => {
    const result = signedUrlRequestSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('rejects invalid content type', () => {
    const result = signedUrlRequestSchema.safeParse({
      ...validInput,
      contentType: 'application/pdf',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Invalid file type');
    }
  });

  it('rejects zero file size', () => {
    const result = signedUrlRequestSchema.safeParse({
      ...validInput,
      fileSize: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative file size', () => {
    const result = signedUrlRequestSchema.safeParse({
      ...validInput,
      fileSize: -100,
    });
    expect(result.success).toBe(false);
  });

  it('rejects file size exceeding max', () => {
    const result = signedUrlRequestSchema.safeParse({
      ...validInput,
      fileSize: MAX_BLOG_IMAGE_SIZE + 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('exceeds maximum size');
    }
  });

  it('accepts file size at exact max', () => {
    const result = signedUrlRequestSchema.safeParse({
      ...validInput,
      fileSize: MAX_BLOG_IMAGE_SIZE,
    });
    expect(result.success).toBe(true);
  });

  it('accepts all allowed content types', () => {
    for (const type of ALLOWED_IMAGE_TYPES) {
      const result = signedUrlRequestSchema.safeParse({
        ...validInput,
        contentType: type,
      });
      expect(result.success).toBe(true);
    }
  });
});
