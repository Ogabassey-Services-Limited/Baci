import ts from 'typescript';

type DefinitionKeys = (identifier: ts.Identifier) => readonly ts.Node[];

function definitionFingerprint(
  file: ts.SourceFile,
  definition: ts.Node,
  definitionKeys: DefinitionKeys,
  seen: ReadonlySet<ts.Node>
): string {
  if (seen.has(definition)) return 'cycle';
  const next = new Set(seen).add(definition);
  if (ts.isBinaryExpression(definition)) {
    return fingerprint(file, definition.right, definitionKeys, next);
  }
  if (ts.isIdentifier(definition)) {
    const parent = definition.parent;
    if (
      (ts.isVariableDeclaration(parent) ||
        ts.isParameter(parent) ||
        ts.isBindingElement(parent)) &&
      parent.initializer
    ) {
      return fingerprint(file, parent.initializer, definitionKeys, next);
    }
    if (ts.isImportSpecifier(parent)) {
      return `import:${parent.propertyName?.text ?? parent.name.text}`;
    }
    return `decl:${ts.SyntaxKind[parent.kind]}:${definition.text}`;
  }
  return `decl:${ts.SyntaxKind[definition.kind]}`;
}

function fingerprint(
  file: ts.SourceFile,
  node: ts.Node,
  definitionKeys: DefinitionKeys,
  seen = new Set<ts.Node>()
): string {
  if (seen.has(node)) return 'cycle';
  const next = new Set(seen).add(node);
  if (ts.isIdentifier(node)) {
    const propertyName =
      (ts.isPropertyAccessExpression(node.parent) &&
        node.parent.name === node) ||
      ((ts.isPropertyAssignment(node.parent) ||
        ts.isMethodDeclaration(node.parent) ||
        ts.isPropertyDeclaration(node.parent)) &&
        node.parent.name === node);
    const values = propertyName
      ? []
      : definitionKeys(node).map((item) =>
          definitionFingerprint(file, item, definitionKeys, next)
        );
    return `id:${node.text}${values.length > 0 ? `=[${values.join('|')}]` : ''}`;
  }
  if (
    ts.isStringLiteralLike(node) ||
    ts.isNumericLiteral(node) ||
    ts.isBigIntLiteral(node)
  ) {
    return `${ts.SyntaxKind[node.kind]}:${node.text}`;
  }
  return `${ts.SyntaxKind[node.kind]}(${node
    .getChildren(file)
    .map((child) => fingerprint(file, child, definitionKeys, next))
    .join(',')})`;
}

export function eventPipelineSemanticFingerprint(
  file: ts.SourceFile,
  node: ts.Node,
  definitionKeys: DefinitionKeys
): string {
  return fingerprint(file, node, definitionKeys);
}
