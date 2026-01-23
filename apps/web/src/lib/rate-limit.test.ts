import { describe, it, expect } from 'vitest';
import { checkRateLimit } from './rate-limit';
import { NextRequest } from 'next/server';

describe('checkRateLimit', () => {
  it('should return correct limits for /api/wallet', () => {
    const req = new NextRequest('http://localhost:3000/api/wallet');
    const result = checkRateLimit(req);

    expect(result.limit).toBe(5);
    expect(result.allowed).toBe(true);
  });

  it('should return default limits for unknown routes', () => {
    const req = new NextRequest('http://localhost:3000/api/unknown');
    const result = checkRateLimit(req);

    expect(result.limit).toBe(50); // Default
    expect(result.allowed).toBe(true);
  });
});
