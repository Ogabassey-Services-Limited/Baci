import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { resolveLexicalModuleSpecifier } from './analytics-delivery-module-specifier';

describe('resolveLexicalModuleSpecifier', () => {
  it('resolves a const-bound template expression recursively', () => {
    const file = ts.createSourceFile(
      'fixture.ts',
      [
        "const directory = '../supabase';",
        "const name = 'service';",
        `const target = \`\${directory}/\${name}\`;`,
        'import(target);',
      ].join(' '),
      ts.ScriptTarget.Latest,
      true
    );
    const call = file.statements
      .flatMap((statement) =>
        ts.isExpressionStatement(statement) &&
        ts.isCallExpression(statement.expression)
          ? [statement.expression]
          : []
      )
      .at(0);
    expect(
      resolveLexicalModuleSpecifier(call?.arguments[0], file, call ?? file)
    ).toBe('../supabase/service');
  });

  it('fails closed for a mutable template substitution', () => {
    const file = ts.createSourceFile(
      'fixture.ts',
      `let name = 'service'; import(\`../supabase/\${name}\`);`,
      ts.ScriptTarget.Latest,
      true
    );
    const call = file.statements
      .flatMap((statement) =>
        ts.isExpressionStatement(statement) &&
        ts.isCallExpression(statement.expression)
          ? [statement.expression]
          : []
      )
      .at(0);
    expect(
      resolveLexicalModuleSpecifier(call?.arguments[0], file, call ?? file)
    ).toBeUndefined();
  });
});
