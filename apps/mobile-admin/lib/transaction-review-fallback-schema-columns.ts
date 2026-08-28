export type TransactionReviewSchemaColumnAvailability = Readonly<{
  adTrackingUnavailable: boolean;
  cancelledAtUnavailable: boolean;
  discountAmountUnavailable: boolean;
  discountCodeUnavailable: boolean;
  lineIdUnavailable: boolean;
  productMatchStatusUnavailable?: boolean;
  quizAwardIdUnavailable: boolean;
  transactionDateUnavailable: boolean;
  unitCostRelationshipUnavailable?: boolean;
  variantAttributesUnavailable?: boolean;
  variantIdUnavailable: boolean;
}>;

type SchemaColumnAvailability =
  | TransactionReviewSchemaColumnAvailability
  | ReadonlySet<string>;

function withoutSchemaColumn(selector: string, column: string) {
  return selector.replace(`, ${column}`, '');
}

function withoutVariantRelationship(selector: string) {
  return withoutSchemaColumn(
    selector.replace(
      ', product_variants(cost_price, sku, attributes, condition)',
      ''
    ),
    'variant_id'
  );
}

export function omitUnavailableTransactionReviewSchemaColumns(
  selector: string,
  availability: SchemaColumnAvailability
) {
  const isUnavailable = (
    key: keyof TransactionReviewSchemaColumnAvailability,
    column: string
  ) => {
    if (availability instanceof Set) return availability.has(column);
    return Boolean(
      (availability as TransactionReviewSchemaColumnAvailability)[key]
    );
  };
  let result = selector;
  if (isUnavailable('quizAwardIdUnavailable', 'quiz_award_id')) {
    result = withoutSchemaColumn(result, 'quiz_award_id');
  }
  if (isUnavailable('discountCodeUnavailable', 'discount_code_id')) {
    result = withoutSchemaColumn(result, 'discount_code_id');
  }
  if (isUnavailable('discountAmountUnavailable', 'discount_amount')) {
    result = withoutSchemaColumn(result, 'discount_amount');
  }
  if (isUnavailable('lineIdUnavailable', 'line_id')) {
    result = withoutSchemaColumn(result, 'line_id');
  }
  if (isUnavailable('adTrackingUnavailable', 'ad_tracking')) {
    result = withoutSchemaColumn(result, 'ad_tracking');
  }
  if (isUnavailable('cancelledAtUnavailable', 'cancelled_at')) {
    result = withoutSchemaColumn(result, 'cancelled_at');
  }
  if (isUnavailable('transactionDateUnavailable', 'transaction_date')) {
    result = withoutSchemaColumn(result, 'transaction_date');
  }
  if (isUnavailable('variantIdUnavailable', 'variant_id')) {
    result = withoutVariantRelationship(result);
  }
  if (isUnavailable('variantAttributesUnavailable', 'variant_attributes')) {
    result = withoutSchemaColumn(result, 'variant_attributes');
  }
  if (isUnavailable('productMatchStatusUnavailable', 'product_match_status')) {
    result = withoutSchemaColumn(result, 'product_match_status');
  }
  if (
    isUnavailable('unitCostRelationshipUnavailable', 'order_item_unit_costs')
  ) {
    result = result.replace(/, order_item_unit_costs\([^)]*\)/, '');
  }
  return result;
}
