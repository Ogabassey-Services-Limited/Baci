import { isAbsolute, relative, resolve, sep } from 'node:path';

function workspaceRoots() {
  const workspaceRoot = process.env.EVIDENCE_WORKSPACE_ROOT;
  const executionRoot = process.env.EVIDENCE_EXECUTION_ROOT ?? workspaceRoot;
  if (
    !workspaceRoot ||
    !executionRoot ||
    !isAbsolute(workspaceRoot) ||
    !isAbsolute(executionRoot)
  )
    throw new Error('absolute EVIDENCE_WORKSPACE_ROOT is required');
  return {
    workspaceRoot: resolve(workspaceRoot),
    executionRoot: resolve(executionRoot),
  };
}

/** Maps journaled source paths into the private, verified execution tree. */
export function mapEvidenceExecutionPath(path: string) {
  const { workspaceRoot, executionRoot } = workspaceRoots();
  const relativePath = relative(workspaceRoot, resolve(path));
  if (
    !relativePath ||
    relativePath === '..' ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  )
    throw new Error('evidence execution path is outside the workspace');
  return resolve(executionRoot, relativePath);
}

export function evidenceExecutionRoot() {
  return workspaceRoots().executionRoot;
}
