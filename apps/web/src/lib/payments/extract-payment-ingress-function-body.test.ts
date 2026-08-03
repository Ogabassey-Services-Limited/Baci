import { describe, expect, it } from 'vitest';
import { extractPaymentIngressFunctionBody } from './extract-payment-ingress-function-body';

describe('extractPaymentIngressFunctionBody', () => {
  it('extracts the body of a private payment ingress function', () => {
    const migrationSql = [
      'CREATE OR REPLACE FUNCTION private.example(uuid)',
      'RETURNS void',
      'LANGUAGE plpgsql',
      'AS $$',
      'BEGIN',
      '  RETURN;',
      'END;',
      '$$;',
    ].join('\n');

    expect(extractPaymentIngressFunctionBody(migrationSql, 'example')).toBe(
      '\nBEGIN\n  RETURN;\nEND;\n'
    );
  });

  it('fails closed when the function or body terminator is missing', () => {
    expect(() =>
      extractPaymentIngressFunctionBody(
        'CREATE TABLE private.example ();',
        'example'
      )
    ).toThrow('missing payment ingress function body: example');
    expect(() =>
      extractPaymentIngressFunctionBody(
        'CREATE OR REPLACE FUNCTION private.example(uuid) AS $$\nBEGIN;',
        'example'
      )
    ).toThrow('missing payment ingress function body: example');
  });
});
