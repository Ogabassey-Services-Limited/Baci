const INVALID_GITHUB_URL_ERROR =
  'Please enter a valid GitHub URL (e.g., https://github.com/username/repo)';

const GITHUB_SEGMENT_PATTERN = '[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?';

// GitHub URL validation pattern: https://github.com/username/repo (with optional .git suffix)
const GITHUB_URL_PATTERN = new RegExp(
  `^https://github\\.com/${GITHUB_SEGMENT_PATTERN}/${GITHUB_SEGMENT_PATTERN}(?:\\.git)?$`
);

export function getGitHubUrlError(url: string): string | null {
  if (!url) return null;
  return GITHUB_URL_PATTERN.test(url) ? null : INVALID_GITHUB_URL_ERROR;
}
