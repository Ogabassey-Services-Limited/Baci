export type EmailSequenceSurface = 'ogabassey' | 'baci-admin';
export type EmailSequenceProvider = 'zeptomail' | 'zoho';
export type EmailSequenceAudienceKind = 'marketing' | 'operational';

export interface EmailSequenceBlueprint {
  id: string;
  audienceKind: EmailSequenceAudienceKind;
  description: string;
  provider: EmailSequenceProvider;
  surface: EmailSequenceSurface;
  trigger: string;
}

export const EMAIL_SEQUENCE_BLUEPRINTS: EmailSequenceBlueprint[] = [
  {
    id: 'ogabassey-blog-announcement',
    audienceKind: 'marketing',
    description:
      'Announce newly published buying guides, launch news, comparisons, and repair advice to opted-in subscribers.',
    provider: 'zoho',
    surface: 'ogabassey',
    trigger: 'Published blog post',
  },
  {
    id: 'ogabassey-new-arrivals',
    audienceKind: 'marketing',
    description:
      'Promote new catalog arrivals by category or brand, including first-look launch campaigns.',
    provider: 'zoho',
    surface: 'ogabassey',
    trigger: 'New active product or collection',
  },
  {
    id: 'ogabassey-abandoned-cart',
    audienceKind: 'marketing',
    description:
      'Recover opted-in carts with product reminders, trust signals, and support links.',
    provider: 'zoho',
    surface: 'ogabassey',
    trigger: 'Opted-in cart inactive after checkout intent',
  },
  {
    id: 'ogabassey-post-purchase-care',
    audienceKind: 'operational',
    description:
      'Send order receipts, delivery updates, warranty reminders, and repair-care tips after purchase.',
    provider: 'zeptomail',
    surface: 'ogabassey',
    trigger: 'Order lifecycle event',
  },
  {
    id: 'merchant-daily-sales-summary',
    audienceKind: 'operational',
    description:
      'Send merchants a daily operational summary of orders, GMV, AOV, top products, and fulfillment exceptions.',
    provider: 'zeptomail',
    surface: 'baci-admin',
    trigger: 'Daily merchant digest cron',
  },
  {
    id: 'merchant-weekly-sales-summary',
    audienceKind: 'operational',
    description:
      'Send merchants a weekly business review with sales trend, customer growth, inventory risks, and recommended actions.',
    provider: 'zeptomail',
    surface: 'baci-admin',
    trigger: 'Weekly merchant digest cron',
  },
  {
    id: 'merchant-low-stock-alert',
    audienceKind: 'operational',
    description:
      'Alert merchants when stock or forecasted stockout risk needs action.',
    provider: 'zeptomail',
    surface: 'baci-admin',
    trigger: 'Inventory forecast or stock threshold',
  },
];

export function getEmailSequenceBlueprints(surface: EmailSequenceSurface) {
  return EMAIL_SEQUENCE_BLUEPRINTS.filter(
    (sequence) => sequence.surface === surface
  );
}
