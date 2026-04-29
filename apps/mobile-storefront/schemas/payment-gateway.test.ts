import { describe, expect, it } from '@jest/globals';
import type { z } from 'zod';
import { PaymentGatewayParamsSchema } from '@/schemas/payment-gateway';

function extractIssuePaths(issues: z.ZodIssue[]) {
  return issues.map((issue) => issue.path.join('.'));
}

describe('PaymentGatewayParamsSchema', () => {
  it('parses an order checkout payload with defaults', () => {
    const result = PaymentGatewayParamsSchema.parse({
      authorizationUrl: 'https://checkout.paystack.com/test',
      gateway: 'paystack',
      orderNumber: 'ORD-123',
      reference: 'ref-123',
    });

    expect(result.authorizationUrl).toBe('https://checkout.paystack.com/test');
    expect(result.gateway).toBe('paystack');
    expect(result.reference).toBe('ref-123');
    expect(result.amount).toBeUndefined();
    expect(result.paymentKind).toBe('order');
  });

  it('requires order ID or order number for order payments', () => {
    const result = PaymentGatewayParamsSchema.safeParse({
      authorizationUrl: 'https://checkout.paystack.com/test',
      gateway: 'paystack',
      paymentKind: 'order',
      reference: 'ref-123',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(extractIssuePaths(result.error.issues)).toContain('orderId');
    }
  });

  it('parses order payments with either order identifier', () => {
    expect(
      PaymentGatewayParamsSchema.safeParse({
        authorizationUrl: 'https://checkout.paystack.com/test',
        gateway: 'paystack',
        orderId: 'order-id-123',
        paymentKind: 'order',
        reference: 'ref-123',
      }).success
    ).toBe(true);
    expect(
      PaymentGatewayParamsSchema.safeParse({
        authorizationUrl: 'https://checkout.paystack.com/test',
        gateway: 'paystack',
        orderNumber: 'ORD-123',
        paymentKind: 'order',
        reference: 'ref-123',
      }).success
    ).toBe(true);
  });

  it.each([
    ['orderId', { orderId: '   ' }],
    ['orderNumber', { orderNumber: '\t' }],
  ])('rejects whitespace-only %s values', (field, identifier) => {
    const result = PaymentGatewayParamsSchema.safeParse({
      authorizationUrl: 'https://checkout.paystack.com/test',
      gateway: 'paystack',
      paymentKind: 'order',
      reference: 'ref-123',
      ...identifier,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(extractIssuePaths(result.error.issues)).toContain(field);
    }
  });

  it('rejects whitespace-only URL, reference, and VTU customer identifier', () => {
    const result = PaymentGatewayParamsSchema.safeParse({
      authorizationUrl: '   ',
      customerIdentifier: ' ',
      gateway: 'paystack',
      paymentKind: 'vtu',
      reference: '\t',
      utilityType: 'power',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(extractIssuePaths(result.error.issues)).toEqual(
        expect.arrayContaining([
          'authorizationUrl',
          'customerIdentifier',
          'reference',
        ])
      );
    }
  });

  it('requires VTU customer and service context for VTU payments', () => {
    const result = PaymentGatewayParamsSchema.safeParse({
      amount: '1000',
      authorizationUrl: 'https://checkout.paystack.com/test',
      gateway: 'paystack',
      paymentKind: 'vtu',
      reference: 'ref-123',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issuePaths = extractIssuePaths(result.error.issues);
      expect(issuePaths).toEqual(
        expect.arrayContaining(['utilityType', 'customerIdentifier'])
      );
    }
  });

  it('parses a valid VTU checkout payload with a positive numeric amount', () => {
    const result = PaymentGatewayParamsSchema.parse({
      amount: '1500.50',
      authorizationUrl: 'https://checkout.paystack.com/test',
      customerIdentifier: '43901766923',
      gateway: 'paystack',
      paymentKind: 'vtu',
      reference: 'ref-123',
      utilityType: 'power',
    });

    expect(result.amount).toBe(1500.5);
    expect(result.customerIdentifier).toBe('43901766923');
    expect(result.paymentKind).toBe('vtu');
    expect(result.utilityType).toBe('power');
  });

  it.each([
    ['amount "0"', '0'],
    ['amount "-1"', '-1'],
    ['non-numeric amount', 'not-a-number'],
  ])('%s is rejected', (_label, amount) => {
    const result = PaymentGatewayParamsSchema.safeParse({
      amount,
      authorizationUrl: 'https://checkout.paystack.com/test',
      gateway: 'paystack',
      orderNumber: 'ORD-123',
      reference: 'ref-123',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(extractIssuePaths(result.error.issues)).toContain('amount');
    }
  });

  it('rejects invalid gateway params', () => {
    const result = PaymentGatewayParamsSchema.safeParse({
      amount: '1000',
      authorizationUrl: 'not-a-url',
      gateway: 'invalid',
      reference: '',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issuePaths = extractIssuePaths(result.error.issues);
      expect(issuePaths).toEqual(
        expect.arrayContaining(['authorizationUrl', 'gateway', 'reference'])
      );
    }
  });
});
