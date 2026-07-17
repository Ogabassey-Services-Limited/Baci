type CanonicalJsonOptions = {
  assertString?: (value: string) => void;
};

function encodeArray(
  value: unknown[],
  ancestors: WeakSet<object>,
  options: CanonicalJsonOptions
): string {
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key === 'symbol')) {
    throw new Error('Canonical value contains a non-JSON array property');
  }
  const indexKeys = (ownKeys as string[]).filter((key) => key !== 'length');
  if (indexKeys.length !== value.length) {
    throw new Error('Canonical value contains a non-JSON array shape');
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const entries = indexKeys
    .sort((left, right) => Number(left) - Number(right))
    .map((key) => {
      const index = Number(key);
      const descriptor = descriptors[key];
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= value.length ||
        String(index) !== key ||
        !descriptor?.enumerable ||
        !('value' in descriptor)
      ) {
        throw new Error('Canonical value contains a non-JSON array property');
      }
      return encodeValue(descriptor.value, ancestors, options);
    });
  return `[${entries.join(',')}]`;
}

function encodeObject(
  value: object,
  ancestors: WeakSet<object>,
  options: CanonicalJsonOptions
): string {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error('Canonical value contains a non-JSON object');
  }
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key === 'symbol')) {
    throw new Error('Canonical value contains a non-JSON symbol key');
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const entries: string[] = [];
  for (const key of (ownKeys as string[]).sort()) {
    options.assertString?.(key);
    const descriptor = descriptors[key];
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      throw new Error('Canonical value contains a non-JSON object property');
    }
    entries.push(
      `${JSON.stringify(key)}:${encodeValue(descriptor.value, ancestors, options)}`
    );
  }
  return `{${entries.join(',')}}`;
}

function encodeValue(
  value: unknown,
  ancestors: WeakSet<object>,
  options: CanonicalJsonOptions
): string {
  if (value === null || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') {
    options.assertString?.(value);
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Canonical value contains a non-JSON number');
    }
    return JSON.stringify(value);
  }
  if (typeof value !== 'object') {
    throw new Error('Canonical value contains a non-JSON value');
  }
  if (ancestors.has(value)) {
    throw new Error('Canonical value contains a non-JSON cycle');
  }
  ancestors.add(value);
  try {
    return Array.isArray(value)
      ? encodeArray(value, ancestors, options)
      : encodeObject(value, ancestors, options);
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalJsonValue(
  value: unknown,
  options: CanonicalJsonOptions = {}
): string {
  return `${encodeValue(value, new WeakSet(), options)}\n`;
}
