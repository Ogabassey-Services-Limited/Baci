import { describe, expect, it } from 'vitest';
import { collectProductionImportClosure } from './event-pipeline-import-closure';

describe('collectProductionImportClosure', () => {
  it('follows imports, re-exports, and literal dynamic imports', () => {
    const sources = new Map([
      [
        'apps/web/src/root.ts',
        "import './direct'; export * from './facade'; import('./dynamic');",
      ],
      ['apps/web/src/direct.ts', 'export {};'],
      ['apps/web/src/facade.ts', "export * from './leaf';"],
      ['apps/web/src/leaf.ts', 'export {};'],
      ['apps/web/src/dynamic.ts', 'export {};'],
    ]);
    expect(
      collectProductionImportClosure(['apps/web/src/root.ts'], sources)
    ).toEqual(new Set(sources.keys()));
  });

  it('follows require calls and TypeScript import-equals declarations', () => {
    const sources = new Map([
      [
        'apps/web/src/root.ts',
        "import direct = require('./direct'); require('./required');",
      ],
      ['apps/web/src/direct.ts', 'export {};'],
      ['apps/web/src/required.ts', 'export {};'],
    ]);
    expect(
      collectProductionImportClosure(['apps/web/src/root.ts'], sources)
    ).toEqual(new Set(sources.keys()));
  });
});
