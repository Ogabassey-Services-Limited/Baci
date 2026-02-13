import { describe, expect, it } from 'vitest';
import { SantaChatDialog } from './santa-chat-dialog';

describe('SantaChatDialog', () => {
  it('exports a valid component', () => {
    expect(SantaChatDialog).toBeDefined();
    expect(typeof SantaChatDialog).toBe('function');
  });
});
