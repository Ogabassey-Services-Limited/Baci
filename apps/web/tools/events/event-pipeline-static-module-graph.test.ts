import { describe, expect, it } from 'vitest';
import { eventPipelineStaticModuleGraph } from './event-pipeline-static-module-graph';

describe('event pipeline static module graph', () => {
  it('collects direct, dynamic, and aliased-require literals', () => {
    const source = [
      "import './direct';",
      "void import('./dynamic');",
      'const load = require;',
      "load('./aliased');",
    ].join('\n');

    expect(
      eventPipelineStaticModuleGraph.moduleReferences('root.ts', source)
    ).toEqual(['./direct', './dynamic', './aliased']);
  });

  it('collects a default import paired with type-only named bindings', () => {
    const source =
      "import RuntimeDefault, { type Shape } from './mixed'; void RuntimeDefault;";

    expect(
      eventPipelineStaticModuleGraph.moduleReferences('root.ts', source)
    ).toEqual(['./mixed']);
  });

  it('keeps empty named clauses as runtime loads and drops type-only-only clauses', () => {
    const source = [
      "import {} from './empty-import';",
      "export {} from './empty-export';",
      "import { type Input } from './type-import';",
      "export { type Output } from './type-export';",
    ].join('\n');

    expect(
      eventPipelineStaticModuleGraph.moduleReferences('root.ts', source)
    ).toEqual(['./empty-import', './empty-export']);
  });

  it('collects bound and conditional literal loader calls', () => {
    const source = [
      "require.bind(null)('./bound');",
      "(flag ? require : require)('./conditional');",
    ].join('\n');

    expect(
      eventPipelineStaticModuleGraph.moduleReferences('root.ts', source)
    ).toEqual(['./bound', './conditional']);
  });

  it('finds an aliased-require path through a local facade', () => {
    const root = 'apps/web/src/lib/events/root.ts';
    const facade = 'apps/web/src/lib/events/facade.ts';
    const service = 'apps/web/src/lib/supabase/service.ts';
    const sources = new Map([
      [root, "const load = require; load('./facade');"],
      [facade, "export * from '@/lib/supabase/service';"],
      [service, 'export {};'],
    ]);

    expect(
      eventPipelineStaticModuleGraph.importPath(
        root,
        new Set([service]),
        sources
      )
    ).toEqual([root, facade, service]);
  });

  it('finds multiple targets in one bounded traversal', () => {
    const root = 'apps/web/src/lib/events/root.ts';
    const left = 'apps/web/src/lib/events/left.ts';
    const right = 'apps/web/src/lib/events/right.ts';
    const sources = new Map([
      [root, "import './left'; import './right';"],
      [left, 'export {};'],
      [right, 'export {};'],
    ]);

    expect(
      eventPipelineStaticModuleGraph.importPaths(
        root,
        new Set([left, right]),
        sources
      )
    ).toEqual(
      new Map([
        [left, [root, left]],
        [right, [root, right]],
      ])
    );
  });

  it('retains a root path for every distinct incoming target edge', () => {
    const root = 'apps/web/src/lib/events/root.ts';
    const safe = 'apps/web/src/lib/events/safe.ts';
    const privileged = 'apps/web/src/lib/events/privileged.ts';
    const target = 'apps/web/src/env.ts';
    const sources = new Map([
      [root, "import './safe'; import './privileged';"],
      [safe, "import { getSupabaseUrl } from '@/env';"],
      [privileged, "import { getSupabaseServiceRoleKey } from '@/env';"],
      [target, 'export {};'],
    ]);

    expect(
      eventPipelineStaticModuleGraph.importTargetPaths(
        root,
        new Set([target]),
        sources
      )
    ).toEqual(
      new Map([
        [
          target,
          [
            [root, safe, target],
            [root, privileged, target],
          ],
        ],
      ])
    );
  });
});
