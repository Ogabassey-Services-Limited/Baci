import { describe, expect, it } from 'vitest';
import { getGitHubUrlError } from './submit-template-repo-input-validation';

describe('getGitHubUrlError', () => {
  it('accepts supported GitHub repository URL forms', () => {
    expect(getGitHubUrlError('')).toBeNull();
    expect(getGitHubUrlError('https://github.com/a/b')).toBeNull();
    expect(
      getGitHubUrlError('https://github.com/merchant/store_front.v2.git')
    ).toBeNull();
  });

  it('rejects non-GitHub and malformed repository URLs', () => {
    expect(getGitHubUrlError('https://example.com/merchant/storefront')).toBe(
      'Please enter a valid GitHub URL (e.g., https://github.com/username/repo)'
    );
    expect(getGitHubUrlError('https://github.com/-merchant/storefront')).toBe(
      'Please enter a valid GitHub URL (e.g., https://github.com/username/repo)'
    );
    expect(getGitHubUrlError('https://github.com/merchant-/storefront')).toBe(
      'Please enter a valid GitHub URL (e.g., https://github.com/username/repo)'
    );
    expect(getGitHubUrlError('https://github.com/merchant/.storefront')).toBe(
      'Please enter a valid GitHub URL (e.g., https://github.com/username/repo)'
    );
    expect(getGitHubUrlError('https://github.com/merchant/storefront-')).toBe(
      'Please enter a valid GitHub URL (e.g., https://github.com/username/repo)'
    );
  });
});
