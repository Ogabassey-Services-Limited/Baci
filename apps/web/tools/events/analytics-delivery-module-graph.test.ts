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
});
