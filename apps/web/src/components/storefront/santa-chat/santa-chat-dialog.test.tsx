import { describe, expect, it, vi } from 'vitest';
import { SantaChatDialog } from './santa-chat-dialog';

// Mock next/font/google to prevent font loading errors in tests
vi.mock('next/font/google', () => ({
  Mountains_of_Christmas: vi.fn(() => ({
    className: 'mocked-font-class',
  })),
}));

describe('SantaChatDialog', () => {
  it('exports a valid component', () => {
    expect(SantaChatDialog).toBeDefined();
    expect(typeof SantaChatDialog).toBe('function');
  });
});
