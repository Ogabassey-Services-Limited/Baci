import { describe, expect, it } from 'vitest';
import type { AgenticCentersData } from './data';

describe('AgenticCentersData contract', () => {
  it('keeps tenant identity explicit in the server-to-client payload', () => {
    const data: Pick<AgenticCentersData, 'merchantId'> = { merchantId: null };
    expect(data.merchantId).toBeNull();
  });
});
