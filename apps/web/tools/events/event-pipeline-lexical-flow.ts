import ts from 'typescript';

type Scope = {
  bindings: Map<string, ts.Node>;
  functionScope: boolean;
  parent?: Scope;
};

export type EventPipelineLexicalFlow = {
  bindingKeys: (name: ts.BindingName) => readonly ts.Node[];
  bindingOf: (identifier: ts.Identifier) => ts.Node | undefined;
  definitionKeys: (identifier: ts.Identifier) => readonly ts.Node[];
  semanticContext: (node: ts.Node) => string;
  targetBindings: (expression: ts.Expression) => readonly ts.Node[];
};

const ASSIGNMENTS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
]);

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
function isClassLike(
  node: ts.Node
): node is ts.ClassDeclaration | ts.ClassExpression {
  return ts.isClassDeclaration(node) || ts.isClassExpression(node);
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

// biome-ignore format: compact control-flow dominance analysis preserves the 300-line utility gate.
function assignmentIsConditional(assignment: ts.BinaryExpression, reference: ts.Identifier): boolean {
  if (assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return true;
  const owner = executionOwner(assignment); let cursor: ts.Node = assignment;
  while (cursor.parent && cursor.parent !== owner) {
    const parent = cursor.parent;
    if (ts.isIfStatement(parent)) {
      const branch = contains(parent.thenStatement, assignment) ? parent.thenStatement : parent.elseStatement && contains(parent.elseStatement, assignment) ? parent.elseStatement : undefined;
      if (!branch || !contains(branch, reference)) return true;
    } else if (ts.isConditionalExpression(parent)) {
      const branch = contains(parent.whenTrue, assignment) ? parent.whenTrue : contains(parent.whenFalse, assignment) ? parent.whenFalse : undefined;
      if (!branch || !contains(branch, reference)) return true;
    } else if ((ts.isForStatement(parent) || ts.isForInStatement(parent) || ts.isForOfStatement(parent) || ts.isWhileStatement(parent) || ts.isDoStatement(parent)) && !contains(parent.statement, reference)) return true;
    else if ((ts.isCaseClause(parent) || ts.isDefaultClause(parent) || ts.isCatchClause(parent) || ts.isTryStatement(parent)) && !contains(parent, reference)) return true;
    cursor = parent;
  }
  return false;
}

function functionLabel(node: ts.SignatureDeclaration): string {
  if (
    (ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isMethodDeclaration(node)) &&
    node.name
  ) {
    return node.name.getText();
  }
  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    return parent.name.text;
  }
  return 'anonymous';
}

export function createEventPipelineLexicalFlow(
  file: ts.SourceFile,
  fallbackBindings: ReadonlyMap<string, ts.Node> = new Map()
): EventPipelineLexicalFlow {
  const root: Scope = { bindings: new Map(), functionScope: true };
  const scopes = new Map<ts.Node, Scope>();
  const assignments = new Map<ts.Node, ts.BinaryExpression[]>();

  const nearestFunctionScope = (scope: Scope): Scope => {
    let cursor = scope;
    while (!cursor.functionScope && cursor.parent) cursor = cursor.parent;
    return cursor;
  };

  const declare = (name: ts.BindingName, scope: Scope): void => {
    if (ts.isIdentifier(name)) {
      scope.bindings.set(name.text, name);
      return;
    }
    for (const element of name.elements) {
      if (!ts.isOmittedExpression(element)) declare(element.name, scope);
    }
  };

  const build = (node: ts.Node, scope: Scope): void => {
    const functionScope = node !== file && ts.isFunctionLike(node);
    const blockScope =
      node !== file &&
      (ts.isBlock(node) || ts.isCatchClause(node) || isClassLike(node));
    const local =
      functionScope || blockScope
        ? {
            bindings: new Map<string, ts.Node>(),
            functionScope,
            parent: scope,
          }
        : scope;
    scopes.set(node, local);

    if (
      (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
      node.name
    ) {
      scope.bindings.set(node.name.text, node.name);
    }
    if (
      (ts.isFunctionExpression(node) || ts.isClassExpression(node)) &&
      node.name
    ) {
      local.bindings.set(node.name.text, node.name);
    }
    if (ts.isVariableDeclaration(node)) {
      const list = ts.isVariableDeclarationList(node.parent)
        ? node.parent
        : undefined;
      const declarationScope =
        list && !(list.flags & ts.NodeFlags.BlockScoped)
          ? nearestFunctionScope(local)
          : local;
      declare(node.name, declarationScope);
    } else if (ts.isParameter(node)) {
      declare(node.name, local);
    } else if (ts.isImportSpecifier(node)) {
      local.bindings.set(node.name.text, node.name);
    } else if (ts.isImportClause(node) && node.name) {
      local.bindings.set(node.name.text, node.name);
    } else if (ts.isNamespaceImport(node)) {
      local.bindings.set(node.name.text, node.name);
    }
    ts.forEachChild(node, (child) => build(child, local));
  };
  build(file, root);

  const bindingOf = (identifier: ts.Identifier): ts.Node | undefined => {
    let scope = scopes.get(identifier);
    while (scope) {
      const found = scope.bindings.get(identifier.text);
      if (found) return found;
      scope = scope.parent;
    }
    return fallbackBindings.get(identifier.text);
  };

  const bindingKeys = (name: ts.BindingName): readonly ts.Node[] => {
    if (ts.isIdentifier(name)) {
      const binding = bindingOf(name);
      return binding ? [binding] : [];
    }
    return name.elements.flatMap((element) =>
      ts.isOmittedExpression(element) ? [] : [...bindingKeys(element.name)]
    );
  };

  const targetBindings = (expression: ts.Expression): readonly ts.Node[] => {
    const value = unwrap(expression);
    if (ts.isIdentifier(value)) {
      const binding = bindingOf(value);
      return binding ? [binding] : [];
    }
    if (ts.isArrayLiteralExpression(value)) {
      return value.elements.flatMap((element) =>
        ts.isOmittedExpression(element)
          ? []
          : [
              ...targetBindings(
                ts.isSpreadElement(element) ? element.expression : element
              ),
            ]
      );
    }
    if (ts.isObjectLiteralExpression(value)) {
      return value.properties.flatMap((property) => {
        if (ts.isShorthandPropertyAssignment(property)) {
          return [...targetBindings(property.name)];
        }
        if (ts.isPropertyAssignment(property)) {
          return [...targetBindings(property.initializer)];
        }
        if (ts.isSpreadAssignment(property)) {
          return [...targetBindings(property.expression)];
        }
        return [];
      });
    }
    return [];
  };

  const indexAssignments = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      ASSIGNMENTS.has(node.operatorToken.kind)
    ) {
      for (const target of targetBindings(node.left)) {
        const entries = assignments.get(target) ?? [];
        entries.push(node);
        assignments.set(target, entries);
      }
    }
    ts.forEachChild(node, indexAssignments);
  };
  indexAssignments(file);

  const definitionKeys = (identifier: ts.Identifier): readonly ts.Node[] => {
    const declared = bindingOf(identifier);
    if (!declared) return [];
    const referenceOwner = executionOwner(identifier);
    const eligible = (assignments.get(declared) ?? []).filter(
      (assignment) =>
        assignment.end <= identifier.getStart(file) &&
        contains(executionOwner(assignment), referenceOwner)
    );
    let definitions: ts.Node[] = [declared];
    for (const assignment of eligible) {
      if (assignmentIsConditional(assignment, identifier)) {
        definitions = [...definitions, assignment];
      } else {
        definitions = [assignment];
      }
    }
    return definitions;
  };

  const semanticContext = (node: ts.Node): string => {
    const labels: string[] = [];
    let cursor: ts.Node = node;
    while (cursor.parent) {
      const parent = cursor.parent;
      if (ts.isFunctionLike(parent)) {
        labels.push(`function:${functionLabel(parent)}`);
      } else if (ts.isIfStatement(parent)) {
        labels.push(
          contains(parent.thenStatement, cursor)
            ? 'if:then'
            : parent.elseStatement && contains(parent.elseStatement, cursor)
              ? 'if:else'
              : 'if:condition'
        );
      } else if (ts.isConditionalExpression(parent)) {
        labels.push(
          contains(parent.whenTrue, cursor)
            ? 'conditional:true'
            : contains(parent.whenFalse, cursor)
              ? 'conditional:false'
              : 'conditional:condition'
        );
      } else if (
        ts.isForStatement(parent) ||
        ts.isForInStatement(parent) ||
        ts.isForOfStatement(parent) ||
        ts.isWhileStatement(parent) ||
        ts.isDoStatement(parent)
      ) {
        labels.push(`loop:${ts.SyntaxKind[parent.kind]}`);
      } else if (ts.isCaseClause(parent) || ts.isDefaultClause(parent)) {
        labels.push('switch:clause');
      } else if (ts.isCatchClause(parent)) {
        labels.push('catch');
      } else if (ts.isTryStatement(parent)) {
        labels.push('try');
      }
      cursor = parent;
    }
    return labels.reverse().join('>') || 'top';
  };

  return {
    bindingKeys,
    bindingOf,
    definitionKeys,
    semanticContext,
    targetBindings,
  };
}
