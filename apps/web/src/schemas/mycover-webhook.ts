import z from 'zod';

export const myCoverWebhookSchema = z.object({
  event: z.string(),
  // Stable per-delivery id used for idempotency (MyCover retries up to ~10x).
  event_id: z.string().optional(),
  // Top-level delivery status (e.g. 'processed') — distinct from claim status.
  status: z.string().optional(),
  data: z
    .object({
      policy_id: z.string().optional(),
      id: z.string().optional(),
      purchase_id: z.string().optional(),
      policy_number: z.string().optional(),
      status: z.string().optional(),
      reference: z.string().optional(),
      customer: z
        .object({
          email: z.email().optional(),
          phone: z.string().optional(),
          first_name: z.string().optional(),
          last_name: z.string().optional(),
        })
        .optional(),
      start_date: z.string().optional(),
      policy_start_date: z.string().optional(),
      expiration_date: z.string().optional(),
      policy_expiry_date: z.string().optional(),
      genius_price: z.number().optional(),
      market_price: z.number().optional(),
      amount: z.union([z.string(), z.number()]).optional(),
      certificate_url: z.string().optional(),
      product_id: z.string().optional(),
      product_category_id: z.string().optional(),
      provider_id: z.string().optional(),
      claim_id: z.string().optional(),
      claim_status: z.string().optional(),
      // Hosted flow links MyCover ships in the `purchase.successful` webhook.
      // There is no REST endpoint to file a claim or run a device inspection;
      // both happen through these hosted URLs.
      sdk: z
        .object({
          claim_link: z.string().optional(),
          inspection_link: z.string().optional(),
        })
        .passthrough()
        .optional(),
      // The documented MyCover envelope nests the real fields under
      // `data.essential` / `data.meta`. We read these first and fall back to
      // the legacy top-level fields above, so both shapes are supported.
      essential: z
        .object({
          policy_id: z.string().optional(),
          policy_number: z.string().optional(),
          expiration_date: z.string().optional(),
          certificate_url: z.string().optional(),
          amount: z.union([z.string(), z.number()]).optional(),
          product_id: z.string().optional(),
          customer_id: z.string().optional(),
          // Claim / inspection fields.
          category: z.string().optional(),
          status: z.string().optional(),
          type: z.string().optional(),
          comment: z.string().optional(),
        })
        .passthrough()
        .optional(),
      meta: z
        .object({
          policy_id: z.string().optional(),
          progress: z.string().optional(),
          comment: z.string().optional(),
        })
        .passthrough()
        .optional(),
    })
    .passthrough(),
  timestamp: z.string().optional(),
});

export type MyCoverWebhookPayload = z.infer<typeof myCoverWebhookSchema>;
