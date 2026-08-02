import { relative, sep } from 'node:path';

/** Allows only owner-authenticated post-merge adapter files to be untracked. */
export function assertToolingStatusAllowsOnlyAuthenticatedAdapters(
  status: string,
  workspaceRoot: string,
  descriptors: readonly Readonly<{ path: string }>[]
) {
  const allowed = new Set(
    descriptors.map((descriptor) =>
      relative(workspaceRoot, descriptor.path).split(sep).join('/')
    )
  );
  for (const record of status.split('\0').filter(Boolean))
    if (!record.startsWith('?? ') || !allowed.has(record.slice(3)))
      throw new Error('tooling worktree is not clean');
}
