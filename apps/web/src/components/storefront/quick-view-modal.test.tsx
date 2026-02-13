import { describe, expect, it } from 'vitest';
import { QuickViewModal } from './quick-view-modal';

describe('QuickViewModal', () => {
  it('exports a valid component', () => {
    expect(QuickViewModal).toBeDefined();
    expect(typeof QuickViewModal).toBe('function');
  });
});
