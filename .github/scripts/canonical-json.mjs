import { createHash } from 'node:crypto';

const unsupported = () => {
  throw new TypeError('unsupported JSON value');
};

function canonicalize(value, ancestors) {
  if (value === null) return 'null';

  switch (typeof value) {
    case 'boolean':
    case 'string':
      return JSON.stringify(value);
    case 'number':
      return Number.isFinite(value) ? JSON.stringify(value) : unsupported();
    case 'object':
      break;
    default:
      return unsupported();
  }

  if (ancestors.has(value)) return unsupported();
  const isArray = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (
    isArray
      ? prototype !== Array.prototype
      : prototype !== Object.prototype && prototype !== null
  ) {
    return unsupported();
  }
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key === 'symbol')) return unsupported();
  if (isArray) {
    const itemKeys = Object.keys(value);
    if (
      ownKeys.length !== value.length + 1 ||
      itemKeys.length !== value.length ||
      itemKeys.some((key, index) => key !== String(index))
    ) {
      return unsupported();
    }
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of ownKeys) {
    const descriptor = descriptors[key];
    const isArrayLength = isArray && key === 'length';
    if (
      !('value' in descriptor) ||
      (!descriptor.enumerable && !isArrayLength)
    ) {
      return unsupported();
    }
  }

  ancestors.add(value);
  let result;
  if (isArray) {
    result = `[${value.map((item) => canonicalize(item, ancestors)).join(',')}]`;
  } else {
    const entries = Object.keys(value)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${canonicalize(value[key], ancestors)}`
      );
    result = `{${entries.join(',')}}`;
  }
  ancestors.delete(value);
  return result;
}

export function canonicalJson(value) {
  return canonicalize(value, new WeakSet());
}

export function canonicalSha256(value) {
  return createHash('sha256')
    .update(canonicalJson(value), 'utf8')
    .digest('hex');
}
