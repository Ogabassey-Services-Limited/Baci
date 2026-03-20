import { describe, expect, it } from 'vitest';
import {
  buildBusinessTypeBreakdowns,
  buildOrderStatusBreakdowns,
  buildPaymentMethodBreakdowns,
} from '@/lib/admin-analytics-breakdowns';

describe('admin-analytics-breakdowns', () => {
  it('normalizes business types against the configured source of truth', () => {
    const breakdowns = buildBusinessTypeBreakdowns(
      ['fashion', ' Church ', null, ''],
      4
    );

    expect(breakdowns).toEqual([
      {
        businessType: 'unspecified',
        classification: 'unspecified',
        label: 'Unspecified',
        merchants: 2,
        rawValues: [],
        shareOfMerchants: 50,
      },
      {
        businessType: 'fashion',
        classification: 'configured',
        label: 'Fashion & Apparel',
        merchants: 1,
        rawValues: [],
        shareOfMerchants: 25,
      },
      {
        businessType: 'invalid',
        classification: 'invalid',
        label: 'Invalid / Legacy Values',
        merchants: 1,
        rawValues: ['Church'],
        shareOfMerchants: 25,
      },
    ]);
  });

  it('builds payment and shipping pipeline breakdowns with shares', () => {
    const orders = [
      {
        payment_method: 'card',
        payment_status: 'paid',
        shipping_status: 'processing',
        total: 700,
      },
      {
        payment_method: null,
        payment_status: 'pending',
        shipping_status: 'pending',
        total: 300,
      },
    ];

    expect(buildOrderStatusBreakdowns(orders, 'payment')).toEqual([
      {
        amount: 700,
        label: 'Paid',
        orders: 1,
        shareOfAmount: 70,
        shareOfOrders: 50,
        status: 'paid',
      },
      {
        amount: 300,
        label: 'Pending',
        orders: 1,
        shareOfAmount: 30,
        shareOfOrders: 50,
        status: 'pending',
      },
    ]);

    expect(buildOrderStatusBreakdowns(orders, 'shipping')).toEqual([
      {
        amount: 300,
        label: 'Pending',
        orders: 1,
        shareOfAmount: 30,
        shareOfOrders: 50,
        status: 'pending',
      },
      {
        amount: 700,
        label: 'Processing',
        orders: 1,
        shareOfAmount: 70,
        shareOfOrders: 50,
        status: 'processing',
      },
    ]);
  });

  it('builds payment method breakdowns from paid orders only', () => {
    const breakdowns = buildPaymentMethodBreakdowns([
      {
        payment_method: 'card',
        payment_status: 'paid',
        shipping_status: 'processing',
        total: 700,
      },
      {
        payment_method: 'bank_transfer',
        payment_status: 'paid',
        shipping_status: 'pending',
        total: 300,
      },
      {
        payment_method: 'card',
        payment_status: 'pending',
        shipping_status: 'pending',
        total: 900,
      },
    ]);

    expect(breakdowns).toEqual([
      {
        amount: 700,
        label: 'Card',
        method: 'card',
        orders: 1,
        shareOfPaidAmount: 70,
        shareOfPaidOrders: 50,
      },
      {
        amount: 300,
        label: 'Bank Transfer',
        method: 'bank_transfer',
        orders: 1,
        shareOfPaidAmount: 30,
        shareOfPaidOrders: 50,
      },
    ]);
  });

  it('handles empty and boundary inputs', () => {
    expect(buildBusinessTypeBreakdowns([], 0)).toEqual([]);
    expect(buildOrderStatusBreakdowns([], 'payment')).toEqual([]);
    expect(buildPaymentMethodBreakdowns([])).toEqual([]);
    expect(
      buildPaymentMethodBreakdowns([
        {
          payment_method: 'card',
          payment_status: 'pending',
          shipping_status: 'pending',
          total: 100,
        },
      ])
    ).toEqual([]);
    expect(
      buildOrderStatusBreakdowns(
        [
          {
            payment_method: 'card',
            payment_status: 'paid',
            shipping_status: 'processing',
            total: 100,
          },
        ],
        'payment'
      )
    ).toEqual([
      {
        amount: 100,
        label: 'Paid',
        orders: 1,
        shareOfAmount: 100,
        shareOfOrders: 100,
        status: 'paid',
      },
    ]);
  });
});
