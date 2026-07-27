import z from 'zod';

const optionalTrimmedString = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim().length === 0 ? undefined : value,
  z.string().trim().min(1).optional()
);

const strictHttpsUrl = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === 'https:', {
    message: 'STOREFRONT_CACHE_ACTUATOR_URL must use HTTPS',
  });

const shape = {
  STOREFRONT_CACHE_ACTUATOR_SECRET: optionalTrimmedString,
  STOREFRONT_CACHE_ACTUATOR_URL: strictHttpsUrl.optional(),
  STOREFRONT_CACHE_CANARY_MERCHANT_ID: z.uuid().optional(),
} as const;

type StorefrontCacheActuatorEnvironment = z.infer<z.ZodObject<typeof shape>>;

function validate(
  value: StorefrontCacheActuatorEnvironment,
  ctx: z.RefinementCtx
): void {
  if (
    value.STOREFRONT_CACHE_ACTUATOR_URL &&
    !value.STOREFRONT_CACHE_ACTUATOR_SECRET
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'STOREFRONT_CACHE_ACTUATOR_SECRET is required when STOREFRONT_CACHE_ACTUATOR_URL is set',
      path: ['STOREFRONT_CACHE_ACTUATOR_SECRET'],
    });
  }
  if (
    value.STOREFRONT_CACHE_ACTUATOR_SECRET &&
    !value.STOREFRONT_CACHE_ACTUATOR_URL
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'STOREFRONT_CACHE_ACTUATOR_URL is required when STOREFRONT_CACHE_ACTUATOR_SECRET is set',
      path: ['STOREFRONT_CACHE_ACTUATOR_URL'],
    });
  }
}

const schema = z.object(shape).strict().superRefine(validate);

export const storefrontCacheActuatorEnvironment = { schema, shape, validate };
