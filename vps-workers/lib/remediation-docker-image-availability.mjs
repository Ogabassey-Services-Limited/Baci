export function isDockerImageUnavailable(error) {
  return /(?:unable to find image|pull access denied|image .* not found|manifest unknown|repository does not exist)/i.test(
    String(error?.message || error || '')
  );
}
