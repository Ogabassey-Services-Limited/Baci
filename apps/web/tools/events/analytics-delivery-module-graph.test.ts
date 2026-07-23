import { describe, expect, it } from 'vitest';
import { analyticsDeliveryModuleGraph } from './analytics-delivery-module-graph';

describe('analyticsDeliveryModuleGraph', () => {
  it('collects require, import-equals, and statically resolved dynamic imports', () => {
    const source = [
      "import direct = require('./direct');",
      "require('./required');",
      "const target = './dynamic'; import(target);",
    ].join('\n');
    expect(
      analyticsDeliveryModuleGraph.moduleReferences('root.ts', source)
    ).toEqual(['./direct', './required', './dynamic']);
  });

  it('resolves lexical template literals used by require and dynamic import', () => {
    const source = [
      "const directory = '../supabase';",
      "const name = 'service';",
      `require(\`\${directory}/\${name}\`);`,
      `const modulePath = \`../analytics/\${name}\`;`,
      'void import(modulePath);',
    ].join('\n');

    expect(
      analyticsDeliveryModuleGraph.moduleReferences('root.ts', source)
    ).toEqual(['../supabase/service', '../analytics/service']);
  });

  it('canonicalizes alias, extension, and relative local specifiers', () => {
    const sources = new Map([
      ['apps/web/src/lib/supabase/admin.ts', 'export {};'],
      ['apps/web/src/app/api/example/route.ts', 'export {};'],
    ]);
    const importer = 'apps/web/src/app/api/example/route.ts';
    expect(
      analyticsDeliveryModuleGraph.resolveLocalModule(
        importer,
        '@/lib/supabase/admin.ts',
        sources
      )
    ).toBe('apps/web/src/lib/supabase/admin.ts');
    expect(
      analyticsDeliveryModuleGraph.resolveLocalModule(
        importer,
        '../../../lib/supabase/admin',
        sources
      )
    ).toBe('apps/web/src/lib/supabase/admin.ts');
  });

  it.each([
    ['../supabase/service.js', 'apps/web/src/lib/supabase/service.ts'],
    ['../supabase/client.js', 'apps/web/src/lib/supabase/client.tsx'],
    ['../supabase/service.mjs', 'apps/web/src/lib/supabase/service.mts'],
    ['../supabase/service.cjs', 'apps/web/src/lib/supabase/service.cts'],
  ])('applies TypeScript bundler substitution for %s', (specifier, expected) => {
    const importer = 'apps/web/src/lib/analytics/root.ts';
    const sources = new Map([
      [importer, 'export {};'],
      [expected, 'export {};'],
    ]);

    expect(
      analyticsDeliveryModuleGraph.resolveLocalModule(
        importer,
        specifier,
        sources
      )
    ).toBe(expected);
  });

  it.each([
    'mts',
    'cts',
  ])('resolves extensionless .%s source modules', (extension) => {
    const importer = 'apps/web/src/lib/analytics/root.ts';
    const expected = `apps/web/src/lib/supabase/service.${extension}`;
    const sources = new Map([
      [importer, 'export {};'],
      [expected, 'export {};'],
    ]);

    expect(
      analyticsDeliveryModuleGraph.resolveLocalModule(
        importer,
        '../supabase/service',
        sources
      )
    ).toBe(expected);
  });

  it('resolves extensionless modules whose basename contains a dot', () => {
    const importer = 'apps/web/src/lib/events/root.ts';
    const target = 'apps/web/src/lib/events/shared.server.ts';
    const sources = new Map([
      [importer, 'export {};'],
      [target, 'export {};'],
    ]);

    expect(
      analyticsDeliveryModuleGraph.resolveLocalModule(
        importer,
        './shared.server',
        sources
      )
    ).toBe(target);
  });

  it('does not resolve the web alias for importers outside apps/web', () => {
    const sources = new Map([
      ['apps/web/src/lib/supabase/service.ts', 'export {};'],
      ['apps/mobile-admin/hooks/useAuth.ts', 'export {};'],
    ]);

    expect(
      analyticsDeliveryModuleGraph.resolveLocalModule(
        'apps/mobile-admin/hooks/useAuth.ts',
        '@/lib/supabase/service',
        sources
      )
    ).toBeUndefined();
  });

  it('normalizes web aliases without allowing them to escape apps/web/src', () => {
    const importer = 'apps/web/src/app/api/example/route.ts';
    const canonicalTarget = 'apps/web/src/lib/supabase/service.ts';
    const escapedTarget = 'apps/web/outside.ts';
    const sources = new Map([
      [importer, 'export {};'],
      [canonicalTarget, 'export {};'],
      [escapedTarget, 'export {};'],
    ]);

    expect(
      analyticsDeliveryModuleGraph.resolveLocalModule(
        importer,
        '@/lib/../lib/supabase/service',
        sources
      )
    ).toBe(canonicalTarget);
    expect(
      analyticsDeliveryModuleGraph.resolveLocalModule(
        importer,
        '@/../outside',
        sources
      )
    ).toBeUndefined();
  });

  it.each([
    '@supabase/supabase-js',
    '@supabase/supabase-js/dist/index.mjs',
  ])('recognizes the Supabase SDK package boundary for %s', (specifier) => {
    expect(analyticsDeliveryModuleGraph.isSupabaseSdkSpecifier(specifier)).toBe(
      true
    );
  });

  it('does not confuse similarly prefixed packages with the Supabase SDK', () => {
    expect(
      analyticsDeliveryModuleGraph.isSupabaseSdkSpecifier(
        '@supabase/supabase-js-extra'
      )
    ).toBe(false);
  });

  it.each([
    'js',
    'jsx',
    'mjs',
    'cjs',
  ])('resolves and traverses .%s source modules', (extension) => {
    const root = `apps/web/src/lib/analytics/root.${extension}`;
    const target = `apps/web/src/lib/supabase/service.${extension}`;
    const sources = new Map([
      [
        root,
        "const directory = '../supabase/'; require(directory + 'service');",
      ],
      [target, 'export const createServiceClient = () => null;'],
    ]);

    expect(
      analyticsDeliveryModuleGraph.importPath(root, new Set([target]), sources)
    ).toEqual([root, target]);
  });
});
