const GIT_REF_PART = /^[^\x00-\x20~^:?*\\[\x7f/]+$/u;

export function validGitRef(value) {
  if (
    typeof value !== 'string' ||
    !value ||
    value === '@' ||
    value.startsWith('/') ||
    value.endsWith('/') ||
    value.includes('..')
  )
    return false;
  return value
    .split('/')
    .every(
      (part) =>
        part &&
        part !== '.' &&
        part !== '..' &&
        !part.startsWith('.') &&
        !part.endsWith('.') &&
        !part.endsWith('.lock') &&
        !part.startsWith('-') &&
        !part.includes('@{') &&
        Buffer.from(part).toString() === part && GIT_REF_PART.test(part)
    );
}
