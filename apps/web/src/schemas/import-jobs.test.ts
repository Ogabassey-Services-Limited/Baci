import { describe, expect, it } from 'vitest';
import {
  importJobEntityTypeSchema,
  importJobFinalizeSchema,
  importJobParamsSchema,
  importJobRowsQuerySchema,
  importJobSourcePlatformSchema,
  importJobStatusSchema,
  importJobUploadInitSchema,
  importJobUploadSchema,
} from '@/schemas/import-jobs';

describe('importJobSourcePlatformSchema', () => {
  it('accepts bumpa', () => {
    expect(importJobSourcePlatformSchema.parse('bumpa')).toBe('bumpa');
  });

  it('rejects unknown platforms', () => {
    const result = importJobSourcePlatformSchema.safeParse('shopify');
    expect(result.success).toBe(false);
  });
});

describe('importJobEntityTypeSchema', () => {
  it('accepts orders', () => {
    expect(importJobEntityTypeSchema.parse('orders')).toBe('orders');
  });

  it('accepts products', () => {
    expect(importJobEntityTypeSchema.parse('products')).toBe('products');
  });

  it('rejects invalid entity types', () => {
    const result = importJobEntityTypeSchema.safeParse('customers');
    expect(result.success).toBe(false);
  });
});

describe('importJobStatusSchema', () => {
  const validStatuses = [
    'uploaded',
    'validating',
    'preview_ready',
    'commit_queued',
    'committing',
    'committed',
    'notify_queued',
    'notifying',
    'completed',
    'failed',
  ];

  it.each(validStatuses)('accepts %s', (status) => {
    expect(importJobStatusSchema.parse(status)).toBe(status);
  });

  it('rejects invalid statuses', () => {
    const result = importJobStatusSchema.safeParse('cancelled');
    expect(result.success).toBe(false);
  });
});

describe('importJobParamsSchema', () => {
  it('accepts a valid UUID jobId', () => {
    const result = importJobParamsSchema.safeParse({
      jobId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-UUID jobId', () => {
    const result = importJobParamsSchema.safeParse({
      jobId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing jobId', () => {
    const result = importJobParamsSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('importJobRowsQuerySchema', () => {
  it('uses defaults when no values provided', () => {
    const result = importJobRowsQuerySchema.parse({});
    expect(result.filter).toBe('all');
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
  });

  it('coerces string numbers', () => {
    const result = importJobRowsQuerySchema.parse({
      page: '3',
      pageSize: '50',
    });
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(50);
  });

  it('rejects pageSize over 100', () => {
    const result = importJobRowsQuerySchema.safeParse({
      pageSize: '101',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-positive page', () => {
    const result = importJobRowsQuerySchema.safeParse({ page: '0' });
    expect(result.success).toBe(false);
  });

  it('accepts supported preview filters', () => {
    const result = importJobRowsQuerySchema.parse({
      filter: 'needs_fix',
    });

    expect(result.filter).toBe('needs_fix');
  });

  it('rejects unsupported preview filters', () => {
    const result = importJobRowsQuerySchema.safeParse({
      filter: 'invalid_filter',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.filter).toBeTruthy();
    }
  });
});

describe('importJobUploadSchema', () => {
  it('accepts valid upload with entityType', () => {
    const result = importJobUploadSchema.parse({
      entityType: 'orders',
    });
    expect(result.sourcePlatform).toBe('bumpa');
    expect(result.entityType).toBe('orders');
  });

  it('defaults sourcePlatform to bumpa', () => {
    const result = importJobUploadSchema.parse({
      entityType: 'products',
    });
    expect(result.sourcePlatform).toBe('bumpa');
  });

  it('rejects missing entityType', () => {
    const result = importJobUploadSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects invalid entityType', () => {
    const result = importJobUploadSchema.safeParse({
      entityType: 'invoices',
    });
    expect(result.success).toBe(false);
  });
});

describe('importJobUploadInitSchema', () => {
  it('accepts valid upload-init metadata', () => {
    const result = importJobUploadInitSchema.parse({
      entityType: 'orders',
      fileName: 'orders.csv',
      fileSizeBytes: 1024,
      contentType: 'text/csv',
    });

    expect(result.sourcePlatform).toBe('bumpa');
    expect(result.fileName).toBe('orders.csv');
  });

  it('rejects unexpected properties', () => {
    const result = importJobUploadInitSchema.safeParse({
      entityType: 'orders',
      fileName: 'orders.csv',
      fileSizeBytes: 1024,
      contentType: 'text/csv',
      extra: 'nope',
    });

    expect(result.success).toBe(false);
  });
});

describe('importJobFinalizeSchema', () => {
  it('accepts a valid client upload id', () => {
    const result = importJobFinalizeSchema.safeParse({
      clientUploadId: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid client upload id format', () => {
    const result = importJobFinalizeSchema.safeParse({
      clientUploadId: 'not-a-uuid',
    });

    expect(result.success).toBe(false);
  });

  it('rejects unexpected properties', () => {
    const result = importJobFinalizeSchema.safeParse({
      clientUploadId: '550e8400-e29b-41d4-a716-446655440000',
      extra: 'nope',
    });

    expect(result.success).toBe(false);
  });
});
