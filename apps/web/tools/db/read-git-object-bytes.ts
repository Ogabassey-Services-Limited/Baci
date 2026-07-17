import { execFile } from 'node:child_process';

const MAX_GIT_OBJECT_BYTES = 32 * 1024 * 1024;
const OBJECT_ID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;

function isSafeObjectSpec(objectSpec: string): boolean {
  const separator = objectSpec.indexOf(':');
  const objectId =
    separator === -1 ? objectSpec : objectSpec.slice(0, separator);
  if (!OBJECT_ID.test(objectId)) return false;
  if (separator === -1) return true;
  const repositoryPath = objectSpec.slice(separator + 1);
  return (
    repositoryPath.length > 0 &&
    !repositoryPath.startsWith('/') &&
    !repositoryPath.includes('\\') &&
    !repositoryPath.includes(':') &&
    !repositoryPath.split('/').includes('..')
  );
}

export function readGitObjectBytes(
  workspaceRoot: string,
  objectSpec: string
): Promise<Buffer> {
  if (!isSafeObjectSpec(objectSpec)) {
    return Promise.reject(new Error('Unsafe Git object spec'));
  }
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      [
        '--no-replace-objects',
        '-C',
        workspaceRoot,
        'show',
        '--no-ext-diff',
        objectSpec,
      ],
      {
        encoding: 'buffer',
        maxBuffer: MAX_GIT_OBJECT_BYTES,
        shell: false,
      },
      (error, stdout) => {
        if (error) {
          reject(new Error('git show failed'));
          return;
        }
        resolve(stdout);
      }
    );
  });
}
