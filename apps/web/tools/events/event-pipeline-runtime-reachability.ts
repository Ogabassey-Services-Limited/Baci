import ts from 'typescript';

type BindingOf = (identifier: ts.Identifier) => ts.Node | undefined;

function unwrap(expression: ts.Expression): ts.Expression {
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isNonNullExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  ) {
    return unwrap(expression.expression);
  }
  return expression;
}

function contains(ancestor: ts.Node, node: ts.Node): boolean {
  return ancestor.pos <= node.pos && ancestor.end >= node.end;
}

function executionOwner(node: ts.Node): ts.Node {
  let cursor: ts.Node | undefined = node;
  while (cursor?.parent) {
    if (ts.isFunctionLike(cursor)) return cursor;
    cursor = cursor.parent;
  }
  return cursor ?? node;
}

function assignmentIsConditional(
  assignment: ts.BinaryExpression,
  reference: ts.Node
): boolean {
  if (assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return true;
  const owner = executionOwner(assignment);
  let cursor: ts.Node = assignment;
  while (cursor.parent && cursor.parent !== owner) {
    const parent = cursor.parent;
    if (ts.isIfStatement(parent)) {
      const branch = contains(parent.thenStatement, assignment)
        ? parent.thenStatement
        : parent.elseStatement && contains(parent.elseStatement, assignment)
          ? parent.elseStatement
          : undefined;
      if (!branch || !contains(branch, reference)) return true;
    } else if (ts.isConditionalExpression(parent)) {
      const branch = contains(parent.whenTrue, assignment)
        ? parent.whenTrue
        : contains(parent.whenFalse, assignment)
          ? parent.whenFalse
          : undefined;
      if (!branch || !contains(branch, reference)) return true;
    } else if (
      (ts.isForStatement(parent) ||
        ts.isForInStatement(parent) ||
        ts.isForOfStatement(parent) ||
        ts.isWhileStatement(parent) ||
        ts.isDoStatement(parent)) &&
      !contains(parent.statement, reference)
    ) {
      return true;
    } else if (
      (ts.isCaseClause(parent) ||
        ts.isDefaultClause(parent) ||
        ts.isCatchClause(parent) ||
        ts.isTryStatement(parent)) &&
      !contains(parent, reference)
    ) {
      return true;
    }
    cursor = parent;
  }
  return false;
}

function callableBinding(owner: ts.Node, bindingOf: BindingOf) {
  if (ts.isFunctionDeclaration(owner) && owner.name) {
    return bindingOf(owner.name);
  }
  if (
    (ts.isArrowFunction(owner) || ts.isFunctionExpression(owner)) &&
    ts.isVariableDeclaration(owner.parent) &&
    ts.isIdentifier(owner.parent.name)
  ) {
    return bindingOf(owner.parent.name);
  }
  return ts.isFunctionExpression(owner) && owner.name
    ? bindingOf(owner.name)
    : undefined;
}

function invokedBinding(call: ts.CallExpression, bindingOf: BindingOf) {
  const callee = unwrap(call.expression);
  if (ts.isIdentifier(callee)) return bindingOf(callee);
  if (
    !ts.isPropertyAccessExpression(callee) &&
    !ts.isElementAccessExpression(callee)
  ) {
    return undefined;
  }
  const member = ts.isPropertyAccessExpression(callee)
    ? callee.name.text
    : ts.isStringLiteralLike(callee.argumentExpression)
      ? callee.argumentExpression.text
      : undefined;
  const target = unwrap(callee.expression);
  return (member === 'call' || member === 'apply') && ts.isIdentifier(target)
    ? bindingOf(target)
    : undefined;
}

function referencesCallableAlias(
  expression: ts.Expression,
  aliases: ReadonlySet<ts.Node>,
  bindingOf: BindingOf
): boolean {
  const value = unwrap(expression);
  if (ts.isIdentifier(value)) {
    const binding = bindingOf(value);
    return Boolean(binding && aliases.has(binding));
  }
  if (ts.isConditionalExpression(value)) {
    return (
      referencesCallableAlias(value.whenTrue, aliases, bindingOf) ||
      referencesCallableAlias(value.whenFalse, aliases, bindingOf)
    );
  }
  if (ts.isBinaryExpression(value)) {
    return value.operatorToken.kind === ts.SyntaxKind.CommaToken
      ? referencesCallableAlias(value.right, aliases, bindingOf)
      : (value.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
          value.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) &&
          (referencesCallableAlias(value.left, aliases, bindingOf) ||
            referencesCallableAlias(value.right, aliases, bindingOf));
  }
  if (!ts.isCallExpression(value)) return false;
  const callee = unwrap(value.expression);
  return (
    (ts.isPropertyAccessExpression(callee) ||
      ts.isElementAccessExpression(callee)) &&
    (ts.isPropertyAccessExpression(callee)
      ? callee.name.text
      : ts.isStringLiteralLike(callee.argumentExpression)
        ? callee.argumentExpression.text
        : undefined) === 'bind' &&
    referencesCallableAlias(callee.expression, aliases, bindingOf)
  );
}

function callableAliases(
  file: ts.SourceFile,
  binding: ts.Node,
  bindingOf: BindingOf
): ReadonlySet<ts.Node> {
  const aliases = new Set<ts.Node>([binding]);
  let changed = true;
  while (changed) {
    changed = false;
    const visit = (node: ts.Node): void => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        ts.isVariableDeclarationList(node.parent) &&
        ts.getCombinedNodeFlags(node.parent) & ts.NodeFlags.Const &&
        referencesCallableAlias(node.initializer, aliases, bindingOf)
      ) {
        const alias = bindingOf(node.name);
        if (alias && !aliases.has(alias)) {
          aliases.add(alias);
          changed = true;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  return aliases;
}

function invocationPoints(
  file: ts.SourceFile,
  owner: ts.Node,
  bindingOf: BindingOf
): ts.CallExpression[] {
  const binding = callableBinding(owner, bindingOf);
  if (!binding) return [];
  const aliases = callableAliases(file, binding, bindingOf);
  const points: ts.CallExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const invoked = invokedBinding(node, bindingOf);
      if (invoked && aliases.has(invoked)) points.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return points;
}

export function eventPipelineRuntimeDefinitions(
  file: ts.SourceFile,
  identifier: ts.Identifier,
  declared: ts.Node,
  assignments: readonly ts.BinaryExpression[],
  bindingOf: BindingOf
): readonly ts.Node[] {
  const referenceOwner = executionOwner(identifier);
  const candidates = assignments.filter((assignment) =>
    contains(executionOwner(assignment), referenceOwner)
  );
  const definitionsAt = (position: number, reference: ts.Node) => {
    let definitions: ts.Node[] = [declared];
    for (const assignment of candidates) {
      if (assignment.end > position) continue;
      definitions = assignmentIsConditional(assignment, reference)
        ? [...definitions, assignment]
        : [assignment];
    }
    return definitions;
  };
  const captured = executionOwner(declared) !== referenceOwner;
  const calls = captured
    ? invocationPoints(file, referenceOwner, bindingOf)
    : [];
  if (!captured || calls.length > 0) {
    const points = calls.length > 0 ? calls : [identifier];
    return [
      ...new Set(
        points.flatMap((point) => definitionsAt(point.getStart(file), point))
      ),
    ];
  }
  const positions = [
    identifier.getStart(file),
    ...candidates.map((assignment) => assignment.end),
  ];
  return [
    ...new Set(
      positions.flatMap((position) =>
        definitionsAt(position, file.endOfFileToken)
      )
    ),
  ];
}
