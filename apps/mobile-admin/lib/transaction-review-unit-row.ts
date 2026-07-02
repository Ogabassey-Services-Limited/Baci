import type { FulfillmentUnitDetails } from './transaction-review-row-helpers';
import {
  getTrimmedString,
  toFiniteNumberOrNull,
} from './transaction-review-row-helpers';
import type {
  TransactionReviewItem,
  TransactionReviewUnitCostRow,
} from './transaction-review-types';

export interface ResolveTransactionReviewUnitRowInput {
  baseCostPrice: number | null;
  baseCostSource: TransactionReviewItem['costSource'];
  baseImeiValues: string[];
  baseSerialValues: string[];
  baseSupplierName: string;
  fulfillmentUnit?: FulfillmentUnitDetails;
  quantity: number;
  unitCost?: TransactionReviewUnitCostRow;
  unitIndex?: number;
  unitPrice: number;
}

export interface ResolvedTransactionReviewUnitRow {
  costPrice: number | null;
  costSource: TransactionReviewItem['costSource'];
  identifierType: 'imei' | 'serial' | null;
  identifierValue: string | null;
  imeiValues: string[];
  profit: number | null;
  quantity: number;
  revenue: number;
  searchTokens: unknown[];
  serialValues: string[];
  supplierName: string;
}

export function resolveTransactionReviewUnitRow({
  baseCostPrice,
  baseCostSource,
  baseImeiValues,
  baseSerialValues,
  baseSupplierName,
  fulfillmentUnit,
  quantity,
  unitCost,
  unitIndex,
  unitPrice,
}: ResolveTransactionReviewUnitRowInput): ResolvedTransactionReviewUnitRow {
  const unitCostPrice = toFiniteNumberOrNull(unitCost?.cost_price);
  const unitSupplierName = getTrimmedString(unitCost?.supplier_name);
  const unitIdentifierType = getTrimmedString(
    unitCost?.identifier_type
  ).toLowerCase();
  const unitIdentifierValue = getTrimmedString(unitCost?.identifier_value);
  const unitCostImeiValues =
    unitIdentifierType === 'imei' && unitIdentifierValue
      ? [unitIdentifierValue]
      : [];
  const unitCostSerialValues =
    unitIdentifierType === 'serial' && unitIdentifierValue
      ? [unitIdentifierValue]
      : [];
  const costPrice = unitCostPrice ?? baseCostPrice;
  const costSource = unitCostPrice != null ? ('unit' as const) : baseCostSource;
  const isOutOfRangeUnit =
    unitIndex != null && (unitIndex < 0 || unitIndex >= quantity);
  const rowQuantity = unitIndex == null ? quantity : isOutOfRangeUnit ? 0 : 1;
  const revenue = unitPrice * rowQuantity;
  const fulfillmentImeiValues = fulfillmentUnit?.imeiValues ?? [];
  const fulfillmentSerialValues = fulfillmentUnit?.serialValues ?? [];
  const imeiValues =
    fulfillmentImeiValues.length > 0
      ? fulfillmentImeiValues
      : unitCostImeiValues.length > 0
        ? unitCostImeiValues
        : unitIndex == null
          ? baseImeiValues
          : [];
  const serialValues =
    fulfillmentSerialValues.length > 0
      ? fulfillmentSerialValues
      : unitCostSerialValues.length > 0
        ? unitCostSerialValues
        : unitIndex == null
          ? baseSerialValues
          : [];
  const identifierType =
    imeiValues[0] != null ? 'imei' : serialValues[0] != null ? 'serial' : null;
  const identifierValue =
    identifierType === 'imei'
      ? (imeiValues[0] ?? null)
      : identifierType === 'serial'
        ? (serialValues[0] ?? null)
        : null;
  const supplierName = unitSupplierName || baseSupplierName;

  return {
    costPrice,
    costSource,
    identifierType,
    identifierValue,
    imeiValues,
    profit: costPrice == null ? null : revenue - costPrice * rowQuantity,
    quantity: rowQuantity,
    revenue,
    searchTokens: [
      supplierName,
      imeiValues,
      serialValues,
      fulfillmentUnit?.searchTokens,
      unitIdentifierValue,
    ],
    serialValues,
    supplierName,
  };
}
