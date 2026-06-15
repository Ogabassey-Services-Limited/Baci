/**
 * Web re-export of the shared storefront post-purchase action helpers.
 *
 * The canonical implementation lives in `@baci/shared/storefront` so the web
 * dashboard, web storefront, and mobile storefront share one source of truth
 * (mobile re-exports the same module). Do not fork logic here.
 */
export {
  BACI_GOOGLE_REVIEW_URL,
  canCancelStorefrontOrder,
  canLeaveStorefrontGoogleReview,
  canRequestStorefrontOrderReturn,
  canShowStorefrontRiderContact,
  CUSTOMER_CANCELLATION_REASONS,
  isStorefrontReceiptAvailable,
} from '@baci/shared/storefront';
export type { CustomerCancellationReason } from '@baci/shared/storefront';
