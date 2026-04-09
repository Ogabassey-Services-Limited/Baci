import { describe, expect, it } from 'vitest';
import {
  bvnVerifySchema,
  cacSearchSchema,
  cacVerifyFormSchema,
  ninVerifySchema,
} from './verification';

describe('cacSearchSchema', () => {
  it('parses a valid search term', () => {
    const result = cacSearchSchema.safeParse({ searchTerm: 'Baci Tech' });
    expect(result.success).toBe(true);
  });

  it('rejects a search term that is too short (1 char)', () => {
    const result = cacSearchSchema.safeParse({ searchTerm: 'B' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty search term', () => {
    const result = cacSearchSchema.safeParse({ searchTerm: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a search term exceeding 200 chars', () => {
    const result = cacSearchSchema.safeParse({
      searchTerm: 'A'.repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it('accepts a search term of exactly 2 chars', () => {
    const result = cacSearchSchema.safeParse({ searchTerm: 'AB' });
    expect(result.success).toBe(true);
  });

  it('accepts a search term of exactly 200 chars', () => {
    const result = cacSearchSchema.safeParse({
      searchTerm: 'A'.repeat(200),
    });
    expect(result.success).toBe(true);
  });
});

describe('cacVerifyFormSchema', () => {
  it('parses valid input', () => {
    const result = cacVerifyFormSchema.safeParse({
      rcNumber: 'RC123456',
      approvedName: 'Baci Technologies Ltd',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty rcNumber', () => {
    const result = cacVerifyFormSchema.safeParse({
      rcNumber: '',
      approvedName: 'Baci Technologies Ltd',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty approvedName', () => {
    const result = cacVerifyFormSchema.safeParse({
      rcNumber: 'RC123456',
      approvedName: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('bvnVerifySchema', () => {
  const validBVN = {
    bvn: '12345678901',
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: '1990-01-01',
    mobileNo: '08012345678',
  };

  it('parses valid BVN data', () => {
    const result = bvnVerifySchema.safeParse(validBVN);
    expect(result.success).toBe(true);
  });

  it('rejects BVN with fewer than 11 digits', () => {
    const result = bvnVerifySchema.safeParse({
      ...validBVN,
      bvn: '1234567890',
    });
    expect(result.success).toBe(false);
  });

  it('rejects BVN with more than 11 digits', () => {
    const result = bvnVerifySchema.safeParse({
      ...validBVN,
      bvn: '123456789012',
    });
    expect(result.success).toBe(false);
  });

  it('rejects BVN containing non-digit characters', () => {
    const result = bvnVerifySchema.safeParse({
      ...validBVN,
      bvn: '1234567890A',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty firstName', () => {
    const result = bvnVerifySchema.safeParse({ ...validBVN, firstName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty lastName', () => {
    const result = bvnVerifySchema.safeParse({ ...validBVN, lastName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty dateOfBirth', () => {
    const result = bvnVerifySchema.safeParse({ ...validBVN, dateOfBirth: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty mobileNo', () => {
    const result = bvnVerifySchema.safeParse({ ...validBVN, mobileNo: '' });
    expect(result.success).toBe(false);
  });
});

describe('ninVerifySchema', () => {
  const validNIN = {
    nin: '12345678901',
    firstName: 'Jane',
    lastName: 'Doe',
    dateOfBirth: '1992-05-15',
  };

  it('parses valid NIN data', () => {
    const result = ninVerifySchema.safeParse(validNIN);
    expect(result.success).toBe(true);
  });

  it('rejects NIN with fewer than 11 digits', () => {
    const result = ninVerifySchema.safeParse({
      ...validNIN,
      nin: '1234567890',
    });
    expect(result.success).toBe(false);
  });

  it('rejects NIN with more than 11 digits', () => {
    const result = ninVerifySchema.safeParse({
      ...validNIN,
      nin: '123456789012',
    });
    expect(result.success).toBe(false);
  });

  it('rejects NIN containing non-digit characters', () => {
    const result = ninVerifySchema.safeParse({
      ...validNIN,
      nin: '1234567890X',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty firstName', () => {
    const result = ninVerifySchema.safeParse({ ...validNIN, firstName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty lastName', () => {
    const result = ninVerifySchema.safeParse({ ...validNIN, lastName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty dateOfBirth', () => {
    const result = ninVerifySchema.safeParse({ ...validNIN, dateOfBirth: '' });
    expect(result.success).toBe(false);
  });
});
