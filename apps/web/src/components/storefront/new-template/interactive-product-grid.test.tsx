import { describe, expect, it } from 'vitest';
import { InteractiveProductGrid } from './interactive-product-grid';

describe('InteractiveProductGrid', () => {
  it('exports a valid component', () => {
    expect(InteractiveProductGrid).toBeDefined();
    expect(typeof InteractiveProductGrid).toBe('function');
  });
});
