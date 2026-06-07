import { describe, expect, it } from 'vitest';
import { agentAuthActionRequestSchema } from './agent-auth-action-request';

describe('agentAuthActionRequestSchema', () => {
  it('accepts claim requests with either email or registration id', () => {
    expect(
      agentAuthActionRequestSchema.safeParse({
        action: 'claim',
        email: 'agent@example.com',
        otp: '123456',
      }).success
    ).toBe(true);
    expect(
      agentAuthActionRequestSchema.safeParse({
        action: 'claim',
        registration_id: 'reg_123',
      }).success
    ).toBe(true);
  });

  it('accepts revoke requests with either logout token or registration id', () => {
    expect(
      agentAuthActionRequestSchema.safeParse({
        action: 'revoke',
        logout_token: 'logout.jwt',
      }).success
    ).toBe(true);
    expect(
      agentAuthActionRequestSchema.safeParse({
        action: 'revoke',
        registration_id: 'reg_123',
      }).success
    ).toBe(true);
  });

  it('rejects missing identifiers and unsupported actions', () => {
    expect(
      agentAuthActionRequestSchema.safeParse({ action: 'claim' }).success
    ).toBe(false);
    expect(
      agentAuthActionRequestSchema.safeParse({ action: 'complete' }).success
    ).toBe(false);
  });

  it('rejects invalid email formats', () => {
    expect(
      agentAuthActionRequestSchema.safeParse({
        action: 'claim',
        email: 'not-an-email',
      }).success
    ).toBe(false);
  });

  it('trims email fields', () => {
    const result = agentAuthActionRequestSchema.safeParse({
      action: 'claim',
      email: ' agent@example.com ',
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ email: 'agent@example.com' });
  });

  it('enforces reason length boundaries', () => {
    expect(
      agentAuthActionRequestSchema.safeParse({
        action: 'revoke',
        logout_token: 'logout.jwt',
        reason: 'x'.repeat(256),
      }).success
    ).toBe(true);
    expect(
      agentAuthActionRequestSchema.safeParse({
        action: 'revoke',
        logout_token: 'logout.jwt',
        reason: 'x'.repeat(257),
      }).success
    ).toBe(false);
  });

  it('rejects empty strings after trimming', () => {
    expect(
      agentAuthActionRequestSchema.safeParse({
        action: 'revoke',
        logout_token: 'logout.jwt',
        reason: '   ',
      }).success
    ).toBe(false);
  });

  it('accepts requests that include both identifiers', () => {
    expect(
      agentAuthActionRequestSchema.safeParse({
        action: 'claim',
        email: 'agent@example.com',
        registration_id: 'reg_123',
      }).success
    ).toBe(true);
    expect(
      agentAuthActionRequestSchema.safeParse({
        action: 'revoke',
        logout_token: 'logout.jwt',
        registration_id: 'reg_123',
      }).success
    ).toBe(true);
  });
});
