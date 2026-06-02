type OrderListVisibilityQuery<TQuery> = {
  not: (column: string, operator: string, value: string) => TQuery;
  or: (filters: string) => TQuery;
};

export const HIDDEN_CHECKOUT_PAYMENT_STATUS_VALUES = [
  'bnpl_pending',
  'failed',
  'expired',
] as const;

export const ONLINE_CHECKOUT_PAYMENT_METHOD_VALUES = [
  'paystack',
  'korapay',
  'bank_transfer',
  'credit_direct',
  'credpal',
  'klump',
  'juicyway',
] as const;

export const HIDDEN_CHECKOUT_PAYMENT_STATUSES = `(${HIDDEN_CHECKOUT_PAYMENT_STATUS_VALUES.join(',')})`;
export const ONLINE_CHECKOUT_PAYMENT_METHODS = `(${ONLINE_CHECKOUT_PAYMENT_METHOD_VALUES.join(',')})`;

export const VISIBLE_PENDING_ORDER_FILTER = [
  'payment_status.not.in.(pending,unpaid)',
  'payment_method.is.null',
  `payment_method.not.in.${ONLINE_CHECKOUT_PAYMENT_METHODS}`,
].join(',');

export function applyOrderListVisibilityFilter<
  TQuery extends OrderListVisibilityQuery<TQuery>,
>(query: TQuery): TQuery {
  return query
    .not('payment_status', 'in', HIDDEN_CHECKOUT_PAYMENT_STATUSES)
    .or(VISIBLE_PENDING_ORDER_FILTER);
}
