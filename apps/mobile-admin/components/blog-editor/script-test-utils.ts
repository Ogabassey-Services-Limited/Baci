import { Script } from 'node:vm';
import { expect } from 'vitest';

export function expectValidJavaScript(
  source: string,
  filename = 'generated-script.js'
) {
  expect(() => new Script(source, { filename })).not.toThrow();
}
