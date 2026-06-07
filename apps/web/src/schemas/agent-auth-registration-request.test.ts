import { describe, expect, it } from 'vitest';
import { agentAuthRegistrationRequestSchema } from './agent-auth-registration-request';

describe('agentAuthRegistrationRequestSchema', () => {
  it('accepts minimal valid requests', () => {
    expect(
      agentAuthRegistrationRequestSchema.safeParse({
        assertion: 'token',
        assertion_type: 'urn:ietf:params:oauth:token-type:id-jag',
        type: 'identity_assertion',
      }).success
    ).toBe(true);
  });

  it('accepts identity assertion registration requests', () => {
    expect(
      agentAuthRegistrationRequestSchema.safeParse({
        assertion: 'eyJhbGciOiJFZERTQSJ9',
        assertion_type: 'urn:ietf:params:oauth:token-type:id-jag',
        client_id: 'https://agent.example/client.json',
        requested_credential_type: 'api_key',
        scopes: ['checkout.write'],
        type: 'identity_assertion',
      }).success
    ).toBe(true);
  });

  it('rejects unsupported identity and credential types', () => {
    expect(
      agentAuthRegistrationRequestSchema.safeParse({
        assertion: 'token',
        assertion_type: 'verified_email',
        requested_credential_type: 'access_token',
        type: 'anonymous',
      }).success
    ).toBe(false);
  });

  it('enforces scopes array max length of 16', () => {
    const request = {
      assertion: 'token',
      assertion_type: 'urn:ietf:params:oauth:token-type:id-jag',
      type: 'identity_assertion',
    };

    expect(
      agentAuthRegistrationRequestSchema.safeParse({
        ...request,
        scopes: Array.from({ length: 16 }, (_, index) => `scope:${index}`),
      }).success
    ).toBe(true);
    expect(
      agentAuthRegistrationRequestSchema.safeParse({
        ...request,
        scopes: Array.from({ length: 17 }, (_, index) => `scope:${index}`),
      }).success
    ).toBe(false);
  });

  it('rejects empty strings for required fields', () => {
    expect(
      agentAuthRegistrationRequestSchema.safeParse({
        assertion: '   ',
        assertion_type: 'urn:ietf:params:oauth:token-type:id-jag',
        type: 'identity_assertion',
      }).success
    ).toBe(false);
    expect(
      agentAuthRegistrationRequestSchema.safeParse({
        assertion: 'token',
        assertion_type: '',
        type: 'identity_assertion',
      }).success
    ).toBe(false);
    expect(
      agentAuthRegistrationRequestSchema.safeParse({
        assertion: 'token',
        assertion_type: 'urn:ietf:params:oauth:token-type:id-jag',
        type: '',
      }).success
    ).toBe(false);
  });

  it('trims string fields', () => {
    const result = agentAuthRegistrationRequestSchema.safeParse({
      assertion: ' token ',
      assertion_type: 'urn:ietf:params:oauth:token-type:id-jag',
      client_id: ' agent-client ',
      scopes: [' checkout.write '],
      type: 'identity_assertion',
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      assertion: 'token',
      client_id: 'agent-client',
      scopes: ['checkout.write'],
    });
  });
});
