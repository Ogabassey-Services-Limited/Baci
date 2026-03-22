import { describe, expect, it } from 'vitest';
import {
  importJobEntityTypeSchema,
  importJobParamsSchema,
  importJobRowsQuerySchema,
  importJobSourcePlatformSchema,
  importJobStatusSchema,
  importJobUploadSchema,
} from './import-jobs';

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
