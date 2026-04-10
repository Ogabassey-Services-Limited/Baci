import z from 'zod';

export const myCoverWebhookSchema = z.object({
  event: z.string(),
  data: z
    .object({
      policy_id: z.string().optional(),
      policy_number: z.string().optional(),
      status: z.string().optional(),
      customer: z
        .object({
          email: z.string().email().optional(),
          phone: z.string().optional(),
          first_name: z.string().optional(),
          last_name: z.string().optional(),
        })
        .optional(),
      start_date: z.string().optional(),
      expiration_date: z.string().optional(),
      genius_price: z.number().optional(),
      market_price: z.number().optional(),
      amount: z.string().optional(),
      certificate_url: z.string().optional(),
      product_id: z.string().optional(),
      product_category_id: z.string().optional(),
      provider_id: z.string().optional(),
      claim_id: z.string().optional(),
      claim_status: z.string().optional(),
    })
    .passthrough(),
  timestamp: z.string().optional(),
});

export type MyCoverWebhookPayload = z.infer<typeof myCoverWebhookSchema>;
