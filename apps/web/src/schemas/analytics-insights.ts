import z from 'zod';

export const analyticsInsightsSchema = z.object({
  insights: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      type: z.enum(['positive', 'negative', 'neutral', 'opportunity']),
      priority: z.enum(['high', 'medium', 'low']),
      action: z
        .string()
        .optional()
        .describe('Suggested action for the merchant'),
    })
  ),
});

export type AnalyticsInsights = z.infer<typeof analyticsInsightsSchema>;
