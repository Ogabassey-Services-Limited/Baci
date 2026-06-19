import { describe, expect, it } from 'vitest';
import { getStorefrontProductsRouteErrorLog } from './route-error-log';

describe('getStorefrontProductsRouteErrorLog', () => {
  it('keeps Error messages and stacks for runtime exceptions', () => {
    const error = new Error('database connection failed');
    error.stack = 'Error: database connection failed\n    at query';

    expect(
      getStorefrontProductsRouteErrorLog(
        error,
        '00000000-0000-4000-8000-000000000001'
      )
    ).toEqual({
      message: 'database connection failed',
      stack: 'Error: database connection failed\n    at query',
      name: 'Error',
      merchantId: '00000000-0000-4000-8000-000000000001',
    });
  });

  it('extracts Supabase error object fields instead of logging Unknown error', () => {
    expect(
      getStorefrontProductsRouteErrorLog(
        {
          message: 'canceling statement due to statement timeout',
          code: '57014',
          details: 'Query timed out while scanning products',
          hint: 'Add an index',
        },
        '00000000-0000-4000-8000-000000000001'
      )
    ).toEqual({
      message: 'canceling statement due to statement timeout',
      code: '57014',
      details: 'Query timed out while scanning products',
      hint: 'Add an index',
      thrownValueType: 'Object',
      merchantId: '00000000-0000-4000-8000-000000000001',
    });
  });

  it('records primitive thrown values without dropping their message', () => {
    expect(getStorefrontProductsRouteErrorLog('query aborted', null)).toEqual({
      message: 'query aborted',
      thrownValueType: 'string',
      merchantId: null,
    });
  });

  it('handles Error subclasses as regular runtime exceptions', () => {
    expect(
      getStorefrontProductsRouteErrorLog(new TypeError('bad product row'), null)
    ).toEqual(
      expect.objectContaining({
        message: 'bad product row',
        name: 'TypeError',
        merchantId: null,
      })
    );
  });

  it('falls back safely for non-message objects and non-string primitives', () => {
    expect(
      getStorefrontProductsRouteErrorLog({ code: 'PGRST000' }, null)
    ).toEqual({
      message: 'Unknown error',
      code: 'PGRST000',
      thrownValueType: 'Object',
      merchantId: null,
    });
    expect(
      getStorefrontProductsRouteErrorLog(
        { message: '', hint: 'Retry later' },
        null
      )
    ).toEqual({
      message: 'Unknown error',
      hint: 'Retry later',
      thrownValueType: 'Object',
      merchantId: null,
    });
    expect(getStorefrontProductsRouteErrorLog(503, null)).toEqual({
      message: 'Unknown error',
      thrownValueType: 'number',
      merchantId: null,
    });
    expect(getStorefrontProductsRouteErrorLog(false, null)).toEqual({
      message: 'Unknown error',
      thrownValueType: 'boolean',
      merchantId: null,
    });
    expect(getStorefrontProductsRouteErrorLog(undefined, null)).toEqual({
      message: 'Unknown error',
      thrownValueType: 'undefined',
      merchantId: null,
    });
    expect(getStorefrontProductsRouteErrorLog(null, null)).toEqual({
      message: 'Unknown error',
      thrownValueType: 'null',
      merchantId: null,
    });
  });
});
