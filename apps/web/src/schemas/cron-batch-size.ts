import { z } from 'zod';

type CronBatchSizeOptions = {
  defaultSize: number;
  maxSize: number;
};

export function createCronBatchSizeSchema({
  defaultSize,
  maxSize,
}: CronBatchSizeOptions) {
  return z
    .preprocess(
      (value) => value ?? defaultSize,
      z.coerce.number().finite().transform(Math.trunc)
    )
    .transform((value) => Math.min(Math.max(value, 1), maxSize));
}
