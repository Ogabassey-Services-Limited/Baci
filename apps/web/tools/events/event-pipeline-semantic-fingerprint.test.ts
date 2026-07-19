import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { parseEventPipelineTypeScriptSource } from '../../src/lib/events/event-pipeline-typescript-source';
import { eventPipelineSemanticFingerprint } from './event-pipeline-semantic-fingerprint';

function parse(source: string) {
  return parseEventPipelineTypeScriptSource(
    'apps/web/src/lib/events/fixture.ts',
    source
  );
}

function descendants<T extends ts.Node>(
  root: ts.Node,
  predicate: (node: ts.Node) => node is T
): T[] {
  const matches: T[] = [];
  const visit = (node: ts.Node) => {
    if (predicate(node)) matches.push(node);
    ts.forEachChild(node, visit);
  };
  visit(root);
  return matches;
}

function predicateFingerprint(source: string): string {
  const file = parse(source);
  const statement = descendants(file, ts.isIfStatement)[0];
  const declarations = new Map(
    descendants(file, ts.isVariableDeclaration)
      .filter((item) => ts.isIdentifier(item.name))
      .map((item) => [(item.name as ts.Identifier).text, item.name])
  );
  return eventPipelineSemanticFingerprint(
    file,
    statement.expression,
    (identifier) => {
      const declaration = declarations.get(identifier.text);
      return declaration ? [declaration] : [];
    }
  );
}

describe('event pipeline semantic fingerprint', () => {
  it('distinguishes normalized inline predicate values', () => {
    expect(predicateFingerprint('if (false) run();')).not.toBe(
      predicateFingerprint('if (true) run();')
    );
  });

  it('includes the reaching definition of a predicate binding', () => {
    expect(
      predicateFingerprint('const enabled = false; if (enabled) run();')
    ).not.toBe(
      predicateFingerprint('const enabled = true; if (enabled) run();')
    );
  });

  it('ignores formatting comments and unrelated declarations', () => {
    expect(
      predicateFingerprint('const enabled = true; if (enabled) run();')
    ).toBe(
      predicateFingerprint(
        'const unrelated = false; const enabled=true; /* stable */ if ( enabled ) run();'
      )
    );
  });
});
