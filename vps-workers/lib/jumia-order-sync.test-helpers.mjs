import assert from 'node:assert/strict';

export function createMarketplaceSupabase(response) {
  const updates = [];
  const expectedEqCalls = [
    ['platform', 'jumia'],
    ['is_active', true],
  ];
  return {
    updates,
    from(table) {
      assert.equal(table, 'marketplace_integrations');
      return {
        select() {
          return this;
        },
        eq(column, value) {
          const expected = expectedEqCalls.shift();
          assert.ok(expected, `Unexpected eq() call: ${column}=${value}`);
          assert.deepEqual([column, value], expected);
          return expectedEqCalls.length === 0
            ? Promise.resolve(response)
            : this;
        },
        update(payload) {
          updates.push(payload);
          return this;
        },
      };
    },
  };
}

export function createHappyPathSupabase({
  integration,
  persistedOrder,
  writes,
}) {
  const queues = {
    marketplace_integrations: [
      createSelectQuery({
        eqs: [
          ['platform', 'jumia'],
          ['is_active', true],
        ],
        response: { data: [integration], error: null },
      }),
      createUpdateQuery({
        table: 'marketplace_integrations',
        writes,
        eqs: [['id', integration.id]],
      }),
    ],
    jumia_orders: [
      createSelectQuery({
        eqs: [['merchant_id', integration.merchant_id]],
        inCall: ['jumia_order_id', ['order-1']],
        response: { data: [], error: null },
      }),
      createUpsertQuery({ table: 'jumia_orders', writes }),
    ],
    orders: [
      createSelectQuery({
        eqs: [
          ['merchant_id', integration.merchant_id],
          ['external_source', 'jumia'],
        ],
        inCall: ['external_id', ['order-1']],
        response: { data: [], error: null },
      }),
      createInsertQuery({
        table: 'orders',
        writes,
        response: { data: persistedOrder, error: null },
        requiresSingle: true,
      }),
    ],
    order_items: [
      createDeleteQuery({
        eqs: [['order_id', persistedOrder.id]],
      }),
      createInsertQuery({
        table: 'order_items',
        writes,
        response: { error: null },
      }),
    ],
    push_tokens: [
      createSelectQuery({
        eqs: [
          ['merchant_id', integration.merchant_id],
          ['is_active', true],
          ['app_type', 'admin'],
        ],
        response: { data: [], error: null },
      }),
    ],
    push_notification_attempts: [
      createInsertQuery({
        table: 'push_notification_attempts',
        writes,
        response: { error: null },
      }),
    ],
  };

  return {
    from(table) {
      const query = queues[table]?.shift();
      assert.ok(query, `Unexpected table query: ${table}`);
      return query;
    },
    assertQueuesEmpty() {
      for (const [table, remaining] of Object.entries(queues)) {
        assert.equal(remaining.length, 0, `Unconsumed ${table} queries`);
      }
    },
  };
}

function createSelectQuery({ eqs = [], inCall, response }) {
  return {
    select() {
      return this;
    },
    eq(column, value) {
      const expected = eqs.shift();
      assert.ok(expected, `Unexpected eq() call: ${column}=${value}`);
      assert.deepEqual([column, value], expected);
      return eqs.length === 0 && !inCall ? Promise.resolve(response) : this;
    },
    in(column, values) {
      assert.deepEqual([column, values], inCall);
      return Promise.resolve(response);
    },
  };
}

function createInsertQuery({
  table,
  writes,
  response,
  requiresSingle = false,
}) {
  return {
    insert(payload) {
      writes.push({ table, operation: 'insert', payload });
      return requiresSingle ? this : Promise.resolve(response);
    },
    select() {
      return this;
    },
    single() {
      return Promise.resolve(response);
    },
  };
}

function createUpdateQuery({ table, writes, eqs }) {
  return {
    update(payload) {
      writes.push({ table, operation: 'update', payload });
      return this;
    },
    eq(column, value) {
      const expected = eqs.shift();
      assert.ok(expected, `Unexpected eq() call: ${column}=${value}`);
      assert.deepEqual([column, value], expected);
      return Promise.resolve({ error: null });
    },
  };
}

function createUpsertQuery({ table, writes }) {
  return {
    upsert(payload) {
      writes.push({ table, operation: 'upsert', payload });
      return Promise.resolve({ error: null });
    },
  };
}

function createDeleteQuery({ eqs }) {
  return {
    delete() {
      return this;
    },
    eq(column, value) {
      const expected = eqs.shift();
      assert.ok(expected, `Unexpected eq() call: ${column}=${value}`);
      assert.deepEqual([column, value], expected);
      return Promise.resolve({ error: null });
    },
  };
}
