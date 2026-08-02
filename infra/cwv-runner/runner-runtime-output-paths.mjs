import { isAbsolute, relative, resolve, sep } from 'node:path';

const isSameOrDescendant = (ancestor, candidate) => {
  const path = relative(resolve(ancestor), resolve(candidate));
  return (
    path === '' ||
    (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`))
  );
};

export function assertDistinctRunnerRuntimeOutputs(
  receiptDirectory,
  projectionDirectory
) {
  if (
    isSameOrDescendant(receiptDirectory, projectionDirectory) ||
    isSameOrDescendant(projectionDirectory, receiptDirectory)
  )
    throw new TypeError('runner runtime output paths refused');
}
