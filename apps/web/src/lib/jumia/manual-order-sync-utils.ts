export function chunkRecords<T>(records: T[], batchSize: number): T[][] {
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new RangeError('batchSize must be a positive integer');
  }

  const chunks: T[][] = [];
  for (let index = 0; index < records.length; index += batchSize) {
    chunks.push(records.slice(index, index + batchSize));
  }
  return chunks;
}
