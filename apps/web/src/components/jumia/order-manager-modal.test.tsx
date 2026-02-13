import { describe, expect, it } from 'vitest';
import { OrderManagerModal } from './order-manager-modal';

describe('OrderManagerModal', () => {
  it('exports a valid component', () => {
    expect(OrderManagerModal).toBeDefined();
    expect(typeof OrderManagerModal).toBe('function');
  });
});
