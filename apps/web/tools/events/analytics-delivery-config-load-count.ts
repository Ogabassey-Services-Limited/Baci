import ts from 'typescript';
import { analyticsDeliveryAuthoritySourceGuards as sourceGuards } from './analytics-delivery-authority-source-guards';

function parse(path: string, source: string): ts.SourceFile {
  return ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
}

function configLoader(
  expression: ts.Expression,
  file: ts.SourceFile,
  specifiers: readonly string[],
  seen = new Set<string>()
): boolean {
  const key = `${expression.pos}:${expression.end}`;
  if (seen.has(key)) return false;
  seen.add(key);
  if (ts.isIdentifier(expression)) {
    if (
      specifiers.some((specifier) =>
        sourceGuards.identifierResolvesToNamedImport(
          expression,
          specifier,
          'fetchAnalyticsPlatformConfig'
        )
      )
    ) {
      return true;
    }
    const writes = sourceGuards.bindingWrites(file, expression);
    return (
      writes.length === 1 &&
      configLoader(writes[0] as ts.Expression, file, specifiers, seen)
    );
  }
  return (
    ts.isPropertyAccessExpression(expression) &&
    expression.name.text === 'fetchAnalyticsPlatformConfig' &&
    ts.isIdentifier(expression.expression) &&
    specifiers.some((specifier) =>
      sourceGuards.identifierResolvesToNamedImport(
        expression.expression,
        specifier,
        '*'
      )
    )
  );
}

export function configLoadCount(
  path: string,
  source: string,
  specifiers: readonly string[]
): number {
  const file = parse(path, source);
  let count = 0;
  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      configLoader(node.expression, file, specifiers)
    ) {
      count += 1;
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return count;
}
