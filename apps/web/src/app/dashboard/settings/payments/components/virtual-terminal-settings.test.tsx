import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: vi.fn(() => ({
    merchant: { id: 'm-1', slug: 'test', currency: 'NGN' },
    loading: false,
  })),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

import { VirtualTerminalSettings } from './virtual-terminal-settings';

describe('VirtualTerminalSettings', () => {
  it('exports a valid component', () => {
    expect(VirtualTerminalSettings).toBeDefined();
    expect(typeof VirtualTerminalSettings).toBe('function');
  });
});
