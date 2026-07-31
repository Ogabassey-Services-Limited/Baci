import { describe, expect, it } from 'vitest';
import { GET, POST, PUT } from './route';

describe('builder route facade', () => {
  it('exposes the GET, POST, and PUT handlers covered by focused suites', () => {
    expect([GET, POST, PUT]).toEqual([
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
    ]);
  });
});
