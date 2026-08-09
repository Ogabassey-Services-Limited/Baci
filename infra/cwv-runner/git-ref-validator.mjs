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
        /^[A-Za-z0-9._-]+$/.test(part)
    );
}
