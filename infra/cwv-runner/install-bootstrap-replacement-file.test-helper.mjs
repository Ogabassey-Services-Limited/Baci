import { rename } from 'node:fs/promises';

export async function exchangeTestPaths(left, right) {
  const scratch = `${left}.test-exchange`;
  await rename(left, scratch);
  await rename(right, left);
  await rename(scratch, right);
}
