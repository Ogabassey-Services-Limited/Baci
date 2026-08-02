const isText = (value) => typeof value === 'string' && value.length > 0;
const isUint32 = (value) =>
  Number.isInteger(value) && value >= 0 && value <= 0xffffffff;

export function assertNoMarkCollision(mark, records) {
  if (!Number.isInteger(mark) || mark < 0 || mark > 0xffffffff)
    throw new TypeError('invalid campaign mark');
  if (!Array.isArray(records))
    throw new TypeError('collision inventory required');
  for (const record of records) {
    if (record?.unsupported) throw new Error('unsupported collision inventory');
    if (
      !record ||
      !isText(record.source) ||
      ![record.mask, record.value].every(isUint32)
    )
      throw new Error('malformed collision inventory');
    if ((mark & record.mask) >>> 0 === (record.value & record.mask) >>> 0)
      throw new Error(`mark collision: ${record.source}`);
  }
}
