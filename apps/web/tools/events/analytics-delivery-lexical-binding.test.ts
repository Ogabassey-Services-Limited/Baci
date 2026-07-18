import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { resolveLexicalBinding } from './analytics-delivery-lexical-binding';

describe('resolveLexicalBinding', () => {
  it('selects the nearest enclosing declaration', () => {
    const file = ts.createSourceFile(
      'fixture.ts',
      "const key = 'outer'; { const key = 'inner'; use(key); }",
      ts.ScriptTarget.Latest,
      true
    );
    let use: ts.Identifier | undefined;
    const visit = (node: ts.Node) => {
      if (
        ts.isIdentifier(node) &&
        node.text === 'key' &&
        ts.isCallExpression(node.parent)
      ) {
        use = node;
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
    if (!use) throw new Error('fixture identifier missing');
    expect(
      resolveLexicalBinding(file, use, use)?.initializer?.getText(file)
    ).toBe("'inner'");
  });
});
