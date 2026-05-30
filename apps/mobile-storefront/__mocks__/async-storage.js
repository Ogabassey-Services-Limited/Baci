const store = new Map();

function resolve(value) {
  return Promise.resolve(value);
}

const AsyncStorage = {
  clear: jest.fn(() => {
    store.clear();
    return resolve(null);
  }),
  flushGetRequests: jest.fn(() => undefined),
  getAllKeys: jest.fn(() => resolve(Array.from(store.keys()))),
  getItem: jest.fn((key) => resolve(store.has(key) ? store.get(key) : null)),
  mergeItem: jest.fn((key, value) => {
    const current = store.get(key);
    store.set(
      key,
      current
        ? JSON.stringify({ ...JSON.parse(current), ...JSON.parse(value) })
        : value
    );
    return resolve(null);
  }),
  multiGet: jest.fn((keys) =>
    resolve(keys.map((key) => [key, store.has(key) ? store.get(key) : null]))
  ),
  multiMerge: jest.fn((entries) => {
    for (const [key, value] of entries) {
      const current = store.get(key);
      store.set(
        key,
        current
          ? JSON.stringify({ ...JSON.parse(current), ...JSON.parse(value) })
          : value
      );
    }
    return resolve(null);
  }),
  multiRemove: jest.fn((keys) => {
    for (const key of keys) {
      store.delete(key);
    }
    return resolve(null);
  }),
  multiSet: jest.fn((entries) => {
    for (const [key, value] of entries) {
      store.set(key, value);
    }
    return resolve(null);
  }),
  removeItem: jest.fn((key) => {
    store.delete(key);
    return resolve(null);
  }),
  setItem: jest.fn((key, value) => {
    store.set(key, value);
    return resolve(null);
  }),
};

module.exports = AsyncStorage;
module.exports.default = AsyncStorage;
