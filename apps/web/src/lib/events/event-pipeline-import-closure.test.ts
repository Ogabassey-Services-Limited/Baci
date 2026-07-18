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

  it.each([
    'js',
    'jsx',
    'mjs',
    'cjs',
    'mts',
    'cts',
  ])('follows an extensionless import into a %s module', (extension) => {
    const source =
      extension === 'jsx'
        ? 'export const View = () => <div />;'
        : 'export const value = true;';
    const sources = new Map([
      ['apps/web/src/root.ts', "import './child';"],
      [`apps/web/src/child.${extension}`, source],
    ]);

    expect(
      collectProductionImportClosure(['apps/web/src/root.ts'], sources)
    ).toEqual(new Set(sources.keys()));
  });

  it.each([
    ['js', 'ts'],
    ['js', 'tsx'],
    ['mjs', 'mts'],
    ['cjs', 'cts'],
  ])('applies TypeScript bundler substitution from .%s imports to .%s sources', (emittedExtension, sourceExtension) => {
    const root = 'apps/web/src/lib/events/governed-root.ts';
    const child = `apps/web/src/lib/events/governed-child.${sourceExtension}`;
    const childSource =
      sourceExtension === 'tsx'
        ? 'export const View = () => <div />;'
        : 'export const governed = true;';
    const sources = new Map([
      [root, `import './governed-child.${emittedExtension}';`],
      [child, childSource],
    ]);

    expect(collectProductionImportClosure([root], sources)).toEqual(
      new Set([root, child])
    );
  });

  it('normalizes web aliases without escaping apps/web/src', () => {
    const root = 'apps/web/src/lib/events/root.ts';
    const child = 'apps/web/src/lib/events/child.ts';
    const escaped = 'apps/web/outside.ts';
    const sources = new Map([
      [root, "import '@/lib/../lib/events/child'; import '@/../../outside';"],
      [child, 'export {};'],
      [escaped, 'export {};'],
    ]);

    expect(collectProductionImportClosure([root], sources)).toEqual(
      new Set([root, child])
    );
  });
});
