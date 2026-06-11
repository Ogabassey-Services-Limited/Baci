import { z } from 'zod';

const createSearchParamSchema = (
  defaultValue: number,
  minValue: number,
  maxValue: number
) =>
  z.preprocess(
    (value) =>
      value === null || value === undefined || value === ''
        ? defaultValue
        : value,
    z.coerce.number().int().min(minValue).max(maxValue)
  );

const imageDimensionSearchParamSchema = (defaultValue: number) =>
  createSearchParamSchema(defaultValue, 128, 3840);

const imageQualitySearchParamSchema = (defaultValue: number) =>
  createSearchParamSchema(defaultValue, 20, 90);

export const ogabasseyPdpLcpImageRequestSchema = z.object({
  productSlug: z
    .string()
    .trim()
    .min(1)
    .max(180)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i),
  quality: imageQualitySearchParamSchema(35),
  width: imageDimensionSearchParamSchema(750),
});

export const ogabasseyPdpLcpImageProfileSchema = z.enum(['mobile', 'desktop']);

export type OgabasseyPdpLcpImageRequest = z.infer<
  typeof ogabasseyPdpLcpImageRequestSchema
>;

export type OgabasseyPdpLcpImageProfile = z.infer<
  typeof ogabasseyPdpLcpImageProfileSchema
>;
