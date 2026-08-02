import { describe, expect, it } from 'vitest';
import { DELETE, POST } from './route';

describe('merchant publish route module', () => {
  it('exports both supported mutation handlers', () => {
    expect(POST).toBeTypeOf('function');
    expect(DELETE).toBeTypeOf('function');
  });
});
