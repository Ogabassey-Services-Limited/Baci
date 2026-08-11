import { describe, expect, it } from 'vitest';
import { GET } from './handler';

describe('Jumia callback handler', () => {
  it('exports the callback GET handler', () => {
    expect(GET).toBeTypeOf('function');
  });
});
