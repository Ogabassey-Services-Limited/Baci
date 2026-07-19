import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { parseEventPipelineTypeScriptSource } from '../../src/lib/events/event-pipeline-typescript-source';
import { eventPipelineRuntimeDefinitions } from './event-pipeline-runtime-reachability';

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

function analyze(source: string) {
  const file = parse(source);
  const declarations = new Map<string, ts.Node>();
  for (const declaration of descendants(file, ts.isVariableDeclaration)) {
    if (ts.isIdentifier(declaration.name)) {
      declarations.set(declaration.name.text, declaration.name);
    }
  }
  for (const declaration of descendants(file, ts.isFunctionDeclaration)) {
    if (declaration.name)
      declarations.set(declaration.name.text, declaration.name);
  }
  const reference = descendants(
    file,
    (node): node is ts.Identifier =>
      ts.isIdentifier(node) &&
      node.text === 'make' &&
      ts.isCallExpression(node.parent) &&
      node.parent.expression === node
  )[0];
  const assignments = descendants(
    file,
    (node): node is ts.BinaryExpression =>
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken
  );
  const declared = declarations.get('make');
  if (!declared) throw new Error('fixture must declare make');
  return {
    assignments,
    declared,
    definitions: eventPipelineRuntimeDefinitions(
      file,
      reference,
      declared,
      assignments,
      (identifier) => declarations.get(identifier.text)
    ),
  };
}

describe('event pipeline runtime reachability', () => {
  it('uses an outer assignment reached before a closure invocation', () => {
    const result = analyze(
      'let make = safe; function run() { make(); } make = createServiceClient; run();'
    );

    expect(result.definitions).toEqual([result.assignments[0]]);
  });

  it('retains a definite safe overwrite reached before invocation', () => {
    const result = analyze(
      'let make = createServiceClient; function run() { make(); } make = safe; run();'
    );

    expect(result.definitions).toEqual([result.assignments[0]]);
  });

  it('unions definitions observed by invocations before and after assignment', () => {
    const result = analyze(
      'let make = safe; function run() { make(); } run(); make = createServiceClient; run();'
    );

    expect(result.definitions).toEqual([
      result.declared,
      result.assignments[0],
    ]);
  });

  it('uses an aliased callable invocation before a later assignment', () => {
    const source =
      'let make = safe; function run() { make(); } const execute = run; execute(); make = createServiceClient;';

    const result = analyze(source);

    expect(result.definitions).toEqual([result.declared]);
  });
});
