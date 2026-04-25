import assert from 'node:assert/strict';

export const baseAlert = {
  id: 'alert-1',
  merchant_id: 'merchant-1',
  alert_type: 'low_stock',
  current_stock: 2,
  threshold: 5,
  notification_attempts: 0,
  products: { id: 'product-1', name: 'Phone Case' },
};

export function createInventorySupabase({
  alerts,
  fetchError = null,
  updateError = null,
}) {
  const updates = [];
  const inventoryFetchQuery = {
    eq() {
      return this;
    },
    order() {
      return this;
    },
    limit() {
      return Promise.resolve({ data: alerts, error: fetchError });
    },
  };
  const inventoryUpdateQuery = {
    eq() {
      return Promise.resolve({ error: updateError });
    },
  };

  return {
    updates,
    from(table) {
      assert.equal(table, 'inventory_alerts');
      return {
        select() {
          return inventoryFetchQuery;
        },
        update(payload) {
          updates.push(payload);
          return inventoryUpdateQuery;
        },
      };
    },
  };
}

export function createLogger() {
  const entries = [];
  return {
    entries,
    error(...args) {
      entries.push(['error', ...args]);
    },
    log(...args) {
      entries.push(['log', ...args]);
    },
    warn(...args) {
      entries.push(['warn', ...args]);
    },
  };
}
