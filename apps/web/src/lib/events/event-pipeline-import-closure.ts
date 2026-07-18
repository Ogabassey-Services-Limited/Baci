import { dirname, normalize } from 'node:path/posix';
import ts from 'typescript';

function localImportPath(
  importer: string,
  specifier: string,
  sources: ReadonlyMap<string, string>
): string | undefined {
  const base = specifier.startsWith('@/')
    ? `apps/web/src/${specifier.slice(2)}`
    : specifier.startsWith('.')
      ? normalize(`${dirname(importer)}/${specifier}`)
      : undefined;
  if (!base) return undefined;
  return ['', '.ts', '.tsx', '/index.ts', '/index.tsx']
    .map((suffix) => `${base}${suffix}`)
    .find((candidate) => sources.has(candidate));
}

export function collectProductionImportClosure(
  roots: readonly string[],
  sources: ReadonlyMap<string, string>
): Set<string> {
  const closure = new Set<string>();
  const pending = [...roots];
  while (pending.length > 0) {
    const path = pending.pop() ?? '';
    if (!path || closure.has(path) || !sources.has(path)) continue;
    closure.add(path);
    const sourceFile = ts.createSourceFile(
      path,
      sources.get(path) ?? '',
      ts.ScriptTarget.Latest,
      true,
      path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    function staticSpecifier(
      expression: ts.Expression | undefined,
      at: ts.Node,
      seen = new Set<string>()
    ): string | undefined {
      if (!expression) return undefined;
      if (ts.isStringLiteralLike(expression)) return expression.text;
      if (
        ts.isBinaryExpression(expression) &&
        expression.operatorToken.kind === ts.SyntaxKind.PlusToken
      ) {
        const left = staticSpecifier(expression.left, at, seen);
        const right = staticSpecifier(expression.right, at, seen);
        return left !== undefined && right !== undefined
          ? `${left}${right}`
          : undefined;
      }
      if (!ts.isIdentifier(expression) || seen.has(expression.text))
        return undefined;
      const name = expression.text;
      seen.add(name);
      let binding: ts.VariableDeclaration | undefined;
      function find(node: ts.Node) {
        if (
          ts.isVariableDeclaration(node) &&
          ts.isIdentifier(node.name) &&
          node.name.text === name &&
          node.pos < at.pos &&
          (!binding || node.pos > binding.pos)
        ) {
          binding = node;
        }
        ts.forEachChild(node, find);
      }
      find(sourceFile);
      return binding &&
        ts.getCombinedNodeFlags(binding.parent) & ts.NodeFlags.Const
        ? staticSpecifier(binding.initializer, binding, seen)
        : undefined;
    }
    function visit(node: ts.Node) {
      const moduleExpression =
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier
          ? node.moduleSpecifier
          : ts.isImportEqualsDeclaration(node) &&
              !node.isTypeOnly &&
              ts.isExternalModuleReference(node.moduleReference)
            ? node.moduleReference.expression
            : ts.isCallExpression(node) &&
                (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
                  (ts.isIdentifier(node.expression) &&
                    node.expression.text === 'require'))
              ? node.arguments[0]
              : undefined;
      const specifier = staticSpecifier(moduleExpression, node);
      if (specifier) {
        const resolved = localImportPath(path, specifier, sources);
        if (resolved && !closure.has(resolved)) pending.push(resolved);
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }
  return closure;
}
