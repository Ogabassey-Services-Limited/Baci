import { describe, expect, it } from 'vitest';
import { buildAgentAuthIssuer } from './agent-auth-issuer';

describe('buildAgentAuthIssuer', () => {
  it('builds the tenant-scoped Auth.md issuer URL', () => {
    expect(buildAgentAuthIssuer('https://merchant.example/')).toBe(
      'https://merchant.example/agent-auth/v1'
    );
  });

  it('normalizes whitespace and trailing slashes', () => {
    expect(buildAgentAuthIssuer(' https://merchant.example/// ')).toBe(
      'https://merchant.example/agent-auth/v1'
    );
  });

  it('rejects malformed base URLs', () => {
    expect(() => buildAgentAuthIssuer('not-a-url')).toThrow(TypeError);
  });
});
