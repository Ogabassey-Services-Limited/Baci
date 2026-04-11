import { describe, expect, it } from 'vitest';
import type { MerchantAnalyticsResponse } from './merchant-analytics';

describe('merchant analytics types', () => {
  it('accepts the shared analytics response contract', () => {
    const value: MerchantAnalyticsResponse = {
      blog: {
        draftPosts: 1,
        publishedPosts: 2,
        topPost: {
          id: 'post-1',
          slug: 'hello-world',
          title: 'Hello World',
          viewCount: 12,
        },
        totalPosts: 3,
        totalViews: 12,
      },
      brandBreakdown: [{ name: 'Apple', revenue: 1200, value: 1200 }],
      chartData: [{ day: 'Apr 10', orders: 1, profit: 600, revenue: 1200, tax: 0 }],
      customerBreakdown: [{ name: 'Customer', revenue: 1200, value: 1 }],
      recentSales: [
        {
          amount: 1200,
          email: 'customer@example.com',
          id: 'order-1',
          name: 'Customer',
          time: '2026-04-10T00:00:00.000Z',
        },
      ],
      salesByChannel: [{ name: 'online_store', value: 1200 }],
      salesByPaymentMethod: [{ name: 'card', value: 1200 }],
      summary: {
        activeNow: { change: 0, value: 1 },
        aov: { change: 0, value: 1200 },
        customers: { change: 0, value: 1 },
        discounts: 0,
        grossMargin: { change: 0, value: 50 },
        revenuePerCustomer: { change: 0, value: 1200 },
        profit: { change: 0, value: 600 },
        refundRate: { change: 0, value: 0 },
        revenue: { change: 0, value: 1200 },
        sales: { change: 0, value: 1 },
        shipping: 0,
        subtotal: 1200,
        tax: 0,
        taxDue: { change: 0, value: 0 },
        totalUnitsSold: 1,
      },
      topBrand: { name: 'Apple', revenue: 1200, value: 1200 },
      topCustomer: { name: 'Customer', value: 1 },
      topPaymentMethod: { name: 'card', value: 100 },
      topProducts: [{ id: 'product-1', name: 'iPhone', revenue: 1200, units: 1 }],
    };

    expect(value.summary.revenue.value).toBe(1200);
    expect(value.blog.topPost?.slug).toBe('hello-world');
  });

  it('accepts nullable analytics branches in the shared contract', () => {
    const value: MerchantAnalyticsResponse = {
      blog: {
        draftPosts: 0,
        publishedPosts: 0,
        topPost: null,
        totalPosts: 0,
        totalViews: 0,
      },
      brandBreakdown: [],
      chartData: [],
      customerBreakdown: [],
      recentSales: [],
      salesByChannel: [],
      salesByPaymentMethod: [],
      summary: {
        activeNow: { change: 0, value: 0 },
        aov: { change: 0, value: 0 },
        customers: { change: 0, value: 0 },
        discounts: 0,
        grossMargin: { change: 0, value: 0 },
        revenuePerCustomer: { change: 0, value: 0 },
        profit: { change: 0, value: 0 },
        refundRate: { change: 0, value: 0 },
        revenue: { change: 0, value: 0 },
        sales: { change: 0, value: 0 },
        shipping: 0,
        subtotal: 0,
        tax: 0,
        taxDue: { change: 0, value: 0 },
        totalUnitsSold: 0,
      },
      topBrand: null,
      topCustomer: null,
      topPaymentMethod: null,
      topProducts: [],
    };

    expect(value.blog.topPost).toBeNull();
    expect(value.topBrand).toBeNull();
  });
});
