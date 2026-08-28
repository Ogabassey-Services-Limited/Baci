function withoutTaxAmount(selector: string) {
  return selector.replace(', tax_amount', '');
}

const transactionReviewSelectors = {
  base: 'id, order_number, created_at, shipping_status, cancelled_at, customer_name, customer_email, customer_phone, payment_method, total, external_source, fulfillment_details, order_items(id, line_id, product_id, variant_id, quiz_award_id, condition, variant_attributes, name, price, quantity, fulfillment_data, products(cost_price, metadata, sku, fulfillment_details))',
  baseCompat:
    'id, order_number, created_at, shipping_status, customer_name, customer_email, customer_phone, payment_method, total, external_source, fulfillment_details, order_items(id, line_id, product_id, variant_id, quiz_award_id, condition, variant_attributes, name, price, quantity, fulfillment_data, products(cost_price, metadata, sku, fulfillment_details))',
  baseWithDiscount:
    'id, order_number, created_at, shipping_status, cancelled_at, customer_name, customer_email, customer_phone, payment_method, total, discount_amount, tax_amount, source, external_source, ad_tracking, fulfillment_details, order_items(id, line_id, product_id, variant_id, quiz_award_id, condition, variant_attributes, name, price, quantity, fulfillment_data, products(cost_price, metadata, sku, fulfillment_details))',
  baseWithDiscountCompat:
    'id, order_number, created_at, shipping_status, customer_name, customer_email, customer_phone, payment_method, total, discount_amount, tax_amount, source, external_source, ad_tracking, fulfillment_details, order_items(id, line_id, product_id, variant_id, quiz_award_id, condition, variant_attributes, name, price, quantity, fulfillment_data, products(cost_price, metadata, sku, fulfillment_details))',
  baseWithDiscountNoLineId:
    'id, order_number, created_at, shipping_status, cancelled_at, customer_name, customer_email, customer_phone, payment_method, total, discount_amount, discount_code_id, tax_amount, source, external_source, ad_tracking, fulfillment_details, order_items(id, product_id, variant_id, quiz_award_id, condition, variant_attributes, name, price, quantity, fulfillment_data, products(cost_price, metadata, sku, fulfillment_details))',
  baseWithDiscountNoVariantId:
    'id, order_number, created_at, shipping_status, cancelled_at, customer_name, customer_email, customer_phone, payment_method, total, discount_amount, discount_code_id, tax_amount, source, external_source, fulfillment_details, order_items(id, line_id, product_id, quiz_award_id, condition, variant_attributes, name, price, quantity, fulfillment_data, products(cost_price, metadata, sku, fulfillment_details))',
  full: 'id, order_number, created_at, transaction_date, shipping_status, cancelled_at, customer_name, customer_email, customer_phone, payment_method, total, discount_amount, discount_code_id, tax_amount, source, external_source, ad_tracking, fulfillment_details, order_items(id, line_id, product_id, variant_id, quiz_award_id, condition, variant_attributes, product_match_status, name, price, quantity, cost_price, assurance_fee, vat_category_code, vat_rate, supplier_name, fulfillment_data, order_item_unit_costs(unit_index, cost_price, supplier_name, identifier_type, identifier_value), product_variants(cost_price, sku, attributes, condition), products(cost_price, metadata, sku, fulfillment_details))',
  fullNoDiscountCode:
    'id, order_number, created_at, transaction_date, shipping_status, cancelled_at, customer_name, customer_email, customer_phone, payment_method, total, discount_amount, tax_amount, source, external_source, ad_tracking, fulfillment_details, order_items(id, line_id, product_id, variant_id, quiz_award_id, condition, variant_attributes, product_match_status, name, price, quantity, cost_price, assurance_fee, vat_category_code, vat_rate, supplier_name, fulfillment_data, order_item_unit_costs(unit_index, cost_price, supplier_name, identifier_type, identifier_value), product_variants(cost_price, sku, attributes, condition), products(cost_price, metadata, sku, fulfillment_details))',
  fullNoDiscount:
    'id, order_number, created_at, transaction_date, shipping_status, cancelled_at, customer_name, customer_email, customer_phone, payment_method, total, discount_code_id, tax_amount, source, external_source, ad_tracking, fulfillment_details, order_items(id, line_id, product_id, variant_id, quiz_award_id, condition, variant_attributes, product_match_status, name, price, quantity, cost_price, assurance_fee, vat_category_code, vat_rate, supplier_name, fulfillment_data, order_item_unit_costs(unit_index, cost_price, supplier_name, identifier_type, identifier_value), product_variants(cost_price, sku, attributes, condition), products(cost_price, metadata, sku, fulfillment_details))',
  legacy:
    'id, order_number, created_at, transaction_date, shipping_status, cancelled_at, customer_name, customer_email, customer_phone, payment_method, total, discount_amount, discount_code_id, tax_amount, source, external_source, ad_tracking, fulfillment_details, order_items(id, line_id, product_id, variant_id, quiz_award_id, condition, variant_attributes, product_match_status, name, price, quantity, cost_price, assurance_fee, vat_category_code, vat_rate, supplier_name, fulfillment_data, product_variants(cost_price, sku, attributes, condition), products(cost_price, metadata, sku, fulfillment_details))',
  legacyNoVariantAttributes:
    'id, order_number, created_at, transaction_date, shipping_status, cancelled_at, customer_name, customer_email, customer_phone, payment_method, total, discount_amount, discount_code_id, tax_amount, source, external_source, ad_tracking, fulfillment_details, order_items(id, line_id, product_id, variant_id, quiz_award_id, condition, product_match_status, name, price, quantity, cost_price, assurance_fee, vat_category_code, vat_rate, supplier_name, fulfillment_data, order_item_unit_costs(unit_index, cost_price, supplier_name, identifier_type, identifier_value), product_variants(cost_price, sku, attributes, condition), products(cost_price, metadata, sku, fulfillment_details))',
  legacyNoVariantAttributesNoLaterFields:
    'id, order_number, created_at, transaction_date, shipping_status, cancelled_at, customer_name, customer_email, customer_phone, payment_method, total, discount_amount, tax_amount, source, external_source, ad_tracking, fulfillment_details, order_items(id, line_id, product_id, variant_id, quiz_award_id, condition, product_match_status, name, price, quantity, cost_price, assurance_fee, vat_category_code, vat_rate, supplier_name, fulfillment_data, product_variants(cost_price, sku, attributes, condition), products(cost_price, metadata, sku, fulfillment_details))',
  legacyNoProductMatchStatus:
    'id, order_number, created_at, transaction_date, shipping_status, cancelled_at, customer_name, customer_email, customer_phone, payment_method, total, discount_amount, discount_code_id, tax_amount, source, external_source, ad_tracking, fulfillment_details, order_items(id, line_id, product_id, variant_id, quiz_award_id, condition, variant_attributes, name, price, quantity, cost_price, assurance_fee, vat_category_code, vat_rate, supplier_name, fulfillment_data, order_item_unit_costs(unit_index, cost_price, supplier_name, identifier_type, identifier_value), product_variants(cost_price, sku, attributes, condition), products(cost_price, metadata, sku, fulfillment_details))',
  legacyNoAdjustments:
    'id, order_number, created_at, transaction_date, shipping_status, cancelled_at, customer_name, customer_email, customer_phone, payment_method, total, discount_amount, discount_code_id, tax_amount, source, external_source, ad_tracking, fulfillment_details, order_items(id, line_id, product_id, variant_id, quiz_award_id, condition, variant_attributes, product_match_status, name, price, quantity, cost_price, supplier_name, fulfillment_data, order_item_unit_costs(unit_index, cost_price, supplier_name, identifier_type, identifier_value), product_variants(cost_price, sku, attributes, condition), products(cost_price, metadata, sku, fulfillment_details))',
  legacyNoDiscountCode:
    'id, order_number, created_at, transaction_date, shipping_status, cancelled_at, customer_name, customer_email, customer_phone, payment_method, total, discount_amount, tax_amount, source, external_source, ad_tracking, fulfillment_details, order_items(id, line_id, product_id, variant_id, quiz_award_id, condition, variant_attributes, product_match_status, name, price, quantity, cost_price, assurance_fee, vat_category_code, vat_rate, supplier_name, fulfillment_data, order_item_unit_costs(unit_index, cost_price, supplier_name, identifier_type, identifier_value), product_variants(cost_price, sku, attributes, condition), products(cost_price, metadata, sku, fulfillment_details))',
  legacyNoAdjustmentsNoDiscountCode:
    'id, order_number, created_at, transaction_date, shipping_status, cancelled_at, customer_name, customer_email, customer_phone, payment_method, total, discount_amount, tax_amount, source, external_source, ad_tracking, fulfillment_details, order_items(id, line_id, product_id, variant_id, quiz_award_id, condition, variant_attributes, product_match_status, name, price, quantity, cost_price, supplier_name, fulfillment_data, order_item_unit_costs(unit_index, cost_price, supplier_name, identifier_type, identifier_value), product_variants(cost_price, sku, attributes, condition), products(cost_price, metadata, sku, fulfillment_details))',
  legacyCompat:
    'id, order_number, created_at, transaction_date, shipping_status, customer_name, customer_email, customer_phone, payment_method, total, discount_amount, discount_code_id, tax_amount, source, external_source, ad_tracking, fulfillment_details, order_items(id, line_id, product_id, variant_id, quiz_award_id, condition, variant_attributes, name, price, quantity, cost_price, assurance_fee, vat_category_code, vat_rate, supplier_name, fulfillment_data, product_variants(cost_price, sku, attributes, condition), products(cost_price, metadata, sku, fulfillment_details))',
  noDiscount:
    'id, order_number, created_at, shipping_status, customer_name, customer_email, customer_phone, payment_method, total, external_source, fulfillment_details, order_items(id, line_id, product_id, variant_id, quiz_award_id, condition, variant_attributes, name, price, quantity, fulfillment_data, products(cost_price, metadata, sku, fulfillment_details))',
  noLineId:
    'id, order_number, created_at, shipping_status, customer_name, customer_email, customer_phone, payment_method, total, external_source, fulfillment_details, order_items(id, product_id, variant_id, quiz_award_id, condition, variant_attributes, name, price, quantity, fulfillment_data, products(cost_price, metadata, sku, fulfillment_details))',
  noVariantId:
    'id, order_number, created_at, shipping_status, customer_name, customer_email, customer_phone, payment_method, total, discount_amount, source, external_source, fulfillment_details, order_items(id, product_id, quiz_award_id, name, price, quantity, fulfillment_data, products(cost_price, metadata, sku, fulfillment_details))',
  noVariantIdNoQuizAwardId:
    'id, order_number, created_at, shipping_status, customer_name, customer_email, customer_phone, payment_method, total, discount_amount, source, external_source, fulfillment_details, order_items(id, product_id, name, price, quantity, fulfillment_data, products(cost_price, metadata, sku, fulfillment_details))',
} as const;

export const TRANSACTION_REVIEW_SELECTORS = {
  ...transactionReviewSelectors,
  baseWithDiscountNoTaxAmount: withoutTaxAmount(
    transactionReviewSelectors.baseWithDiscount
  ),
  baseWithDiscountCompatNoTaxAmount: withoutTaxAmount(
    transactionReviewSelectors.baseWithDiscountCompat
  ),
  baseWithDiscountNoLineIdNoTaxAmount: withoutTaxAmount(
    transactionReviewSelectors.baseWithDiscountNoLineId
  ),
  baseWithDiscountNoVariantIdNoTaxAmount: withoutTaxAmount(
    transactionReviewSelectors.baseWithDiscountNoVariantId
  ),
  fullNoTaxAmount: withoutTaxAmount(transactionReviewSelectors.full),
  fullNoDiscountCodeNoTaxAmount: withoutTaxAmount(
    transactionReviewSelectors.fullNoDiscountCode
  ),
  fullNoDiscountNoTaxAmount: withoutTaxAmount(
    transactionReviewSelectors.fullNoDiscount
  ),
  legacyNoTaxAmount: withoutTaxAmount(transactionReviewSelectors.legacy),
  legacyNoVariantAttributesNoTaxAmount: withoutTaxAmount(
    transactionReviewSelectors.legacyNoVariantAttributes
  ),
  legacyNoVariantAttributesNoLaterFieldsNoTaxAmount: withoutTaxAmount(
    transactionReviewSelectors.legacyNoVariantAttributesNoLaterFields
  ),
  legacyNoProductMatchStatusNoTaxAmount: withoutTaxAmount(
    transactionReviewSelectors.legacyNoProductMatchStatus
  ),
  legacyNoAdjustmentsNoTaxAmount: withoutTaxAmount(
    transactionReviewSelectors.legacyNoAdjustments
  ),
  legacyNoDiscountCodeNoTaxAmount: withoutTaxAmount(
    transactionReviewSelectors.legacyNoDiscountCode
  ),
  legacyNoAdjustmentsNoDiscountCodeNoTaxAmount: withoutTaxAmount(
    transactionReviewSelectors.legacyNoAdjustmentsNoDiscountCode
  ),
  legacyCompatNoTaxAmount: withoutTaxAmount(
    transactionReviewSelectors.legacyCompat
  ),
} as const;
