import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { parseEventPipelineTypeScriptSource } from '../../src/lib/events/event-pipeline-typescript-source';
import { createEventPipelineLexicalFlow } from './event-pipeline-lexical-flow';

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

function calledIdentifiers(file: ts.SourceFile, name: string) {
  return descendants(
    file,
    (node): node is ts.Identifier =>
      ts.isIdentifier(node) &&
      node.text === name &&
      ts.isCallExpression(node.parent) &&
      node.parent.expression === node
  );
}

describe('event pipeline lexical flow', () => {
  it('resolves shadowed parameters independently from the imported binding', () => {
    const file = parse(
      "import { createServiceClient } from '@/lib/supabase/service'; function safe(createServiceClient) { createServiceClient(); } createServiceClient();"
    );
    const flow = createEventPipelineLexicalFlow(file);
    const calls = calledIdentifiers(file, 'createServiceClient');
    const parameter = descendants(file, ts.isParameter)[0];

    expect(flow.bindingOf(calls[0])).toBe(flow.bindingKeys(parameter.name)[0]);
    expect(flow.bindingOf(calls[1])).not.toBe(flow.bindingOf(calls[0]));
  });

  it('uses the last definite assignment across an unconditional nested block', () => {
    const file = parse(
      'let make = safe; { make = createServiceClient; } make();'
    );
    const flow = createEventPipelineLexicalFlow(file);
    const assignment = descendants(
      file,
      (node): node is ts.BinaryExpression =>
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken
    )[0];

    expect(flow.definitionKeys(calledIdentifiers(file, 'make')[0])).toEqual([
      assignment,
    ]);
  });

  it('unions conditional and logical assignments with the prior definition', () => {
    const file = parse(
      'let make = createServiceClient; if (flag) make = safe; make ??= fallback; make();'
    );
    const flow = createEventPipelineLexicalFlow(file);
    const definitions = flow.definitionKeys(calledIdentifiers(file, 'make')[0]);
    const declaration = descendants(file, ts.isVariableDeclaration)[0];

    expect(definitions).toHaveLength(3);
    expect(definitions).toContain(flow.bindingKeys(declaration.name)[0]);
  });

  it('hoists var bindings to the containing execution scope', () => {
    const file = parse('if (flag) { var make = createServiceClient; } make();');
    const flow = createEventPipelineLexicalFlow(file);
    const declaration = descendants(file, ts.isVariableDeclaration)[0];

    expect(flow.bindingOf(calledIdentifiers(file, 'make')[0])).toBe(
      flow.bindingKeys(declaration.name)[0]
    );
  });

  it('gives relocated authority uses distinct structural contexts', () => {
    const file = parse(
      'if (false) createServiceClient("legacy"); createServiceClient("current");'
    );
    const flow = createEventPipelineLexicalFlow(file);
    const calls = calledIdentifiers(file, 'createServiceClient');

    expect(flow.semanticContext(calls[0].parent)).not.toBe(
      flow.semanticContext(calls[1].parent)
    );
    expect(flow.semanticContext(calls[1].parent)).toBe('top');
  });

  it('resolves a closure reference at its later invocation point', () => {
    const file = parse(
      'let make = safe; function run() { make(); } make = createServiceClient; run();'
    );
    const flow = createEventPipelineLexicalFlow(file);
    const assignment = descendants(
      file,
      (node): node is ts.BinaryExpression =>
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken
    )[0];

    expect(flow.definitionKeys(calledIdentifiers(file, 'make')[0])).toEqual([
      assignment,
    ]);
  });

  it('keeps a definite safe overwrite visible to a later closure invocation', () => {
    const file = parse(
      'let make = createServiceClient; function run() { make(); } make = safe; run();'
    );
    const flow = createEventPipelineLexicalFlow(file);
    const assignment = descendants(
      file,
      (node): node is ts.BinaryExpression =>
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken
    )[0];

    expect(flow.definitionKeys(calledIdentifiers(file, 'make')[0])).toEqual([
      assignment,
    ]);
  });

  it('unions closure definitions reached by calls on both sides of an assignment', () => {
    const file = parse(
      'let make = safe; function run() { make(); } run(); make = createServiceClient; run();'
    );
    const flow = createEventPipelineLexicalFlow(file);
    const declaration = descendants(file, ts.isVariableDeclaration)[0];
    const assignment = descendants(
      file,
      (node): node is ts.BinaryExpression =>
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken
    )[0];

    expect(flow.definitionKeys(calledIdentifiers(file, 'make')[0])).toEqual([
      flow.bindingKeys(declaration.name)[0],
      assignment,
    ]);
  });

  it('keeps a for-loop lexical shadow separate from the imported binding', () => {
    const file = parse(
      "import { createServiceClient } from '@/lib/supabase/service'; for (const createServiceClient of safeFactories) { createServiceClient(); } createServiceClient();"
    );
    const flow = createEventPipelineLexicalFlow(file);
    const calls = calledIdentifiers(file, 'createServiceClient');
    const declaration = descendants(file, ts.isVariableDeclaration)[0];

    expect(flow.bindingOf(calls[0])).toBe(
      flow.bindingKeys(declaration.name)[0]
    );
    expect(flow.bindingOf(calls[1])).not.toBe(flow.bindingOf(calls[0]));
  });

  it('keeps a switch-case lexical shadow separate from the imported binding', () => {
    const file = parse(
      "import { createServiceClient } from '@/lib/supabase/service'; switch (kind) { case 'safe': const createServiceClient = safe; createServiceClient(); break; } createServiceClient();"
    );
    const flow = createEventPipelineLexicalFlow(file);
    const calls = calledIdentifiers(file, 'createServiceClient');
    const declaration = descendants(file, ts.isVariableDeclaration)[0];

    expect(flow.bindingOf(calls[0])).toBe(
      flow.bindingKeys(declaration.name)[0]
    );
    expect(flow.bindingOf(calls[1])).not.toBe(flow.bindingOf(calls[0]));
  });

  it('changes semantic context when an inline control predicate changes', () => {
    const frozen = parse('if (false) createServiceClient();');
    const current = parse('if (true) createServiceClient();');
    const frozenFlow = createEventPipelineLexicalFlow(frozen);
    const currentFlow = createEventPipelineLexicalFlow(current);

    expect(
      frozenFlow.semanticContext(
        calledIdentifiers(frozen, 'createServiceClient')[0].parent
      )
    ).not.toBe(
      currentFlow.semanticContext(
        calledIdentifiers(current, 'createServiceClient')[0].parent
      )
    );
  });

  it('changes semantic context when a predicate definition changes', () => {
    const frozen = parse(
      'const enabled = false; if (enabled) createServiceClient();'
    );
    const current = parse(
      'const enabled = true; if (enabled) createServiceClient();'
    );
    const frozenFlow = createEventPipelineLexicalFlow(frozen);
    const currentFlow = createEventPipelineLexicalFlow(current);

    expect(
      frozenFlow.semanticContext(
        calledIdentifiers(frozen, 'createServiceClient')[0].parent
      )
    ).not.toBe(
      currentFlow.semanticContext(
        calledIdentifiers(current, 'createServiceClient')[0].parent
      )
    );
  });

  it('keeps semantic context stable across formatting comments and unrelated edits', () => {
    const frozen = parse(
      'const enabled = true; if (enabled) createServiceClient();'
    );
    const current = parse(
      'const unrelated = 1; const enabled=true; /* stable */ if ( enabled ) { createServiceClient(); }'
    );
    const frozenFlow = createEventPipelineLexicalFlow(frozen);
    const currentFlow = createEventPipelineLexicalFlow(current);

    expect(
      frozenFlow.semanticContext(
        calledIdentifiers(frozen, 'createServiceClient')[0].parent
      )
    ).toBe(
      currentFlow.semanticContext(
        calledIdentifiers(current, 'createServiceClient')[0].parent
      )
    );
  });
});
