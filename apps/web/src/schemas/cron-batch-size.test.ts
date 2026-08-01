import { describe, expect, it } from 'vitest';
import { createCronBatchSizeSchema } from './cron-batch-size';

const schema = createCronBatchSizeSchema({ defaultSize: 25, maxSize: 50 });

describe('createCronBatchSizeSchema', () => {
  it('defaults missing values and truncates numeric input', () => {
    expect(schema.parse(null)).toBe(25);
    expect(schema.parse('9.9')).toBe(9);
  });

  it('clamps values to the inclusive range from one to the configured maximum', () => {
    expect(schema.parse('0')).toBe(1);
    expect(schema.parse('999')).toBe(50);
  });

  it('rejects non-finite or non-numeric values', () => {
    expect(schema.safeParse('not-a-number').success).toBe(false);
    expect(schema.safeParse('Infinity').success).toBe(false);
  });
});
