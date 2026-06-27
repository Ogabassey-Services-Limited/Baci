export type ImportPreviewRowStatus =
  | 'create'
  | 'update'
  | 'duplicate'
  | 'invalid';

export interface ImportPreviewSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  createCount: number;
  updateCount: number;
  duplicateCount: number;
  claimableCustomers: number;
  phoneOnlyCustomers: number;
  anonymousCustomers: number;
  unmatchedItems: number;
  receiptReadyOrders: number;
}

export interface NormalizedImportedCustomer {
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  claimable: boolean;
}

export interface NormalizedImportedOrderItem {
  productId: string | null;
  productName: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  matched: boolean;
  matchSource: 'sku' | 'name' | 'unmatched';
  importMetadata?: Record<string, unknown>;
}

export interface NormalizedImportedShippingAddress {
  fullAddress: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  source: string;
}

export interface NormalizedImportedOrder {
  sourcePlatform: 'bumpa';
  externalSourceId: string;
  orderNumber: string;
  customer: NormalizedImportedCustomer;
  paymentStatus: string;
  shippingStatus: string;
  sourceOrderStatus: string;
  sourceShippingStatus: string | null;
  sourceChannel: string | null;
  sourceOrigin: string | null;
  total: number;
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  taxAmount: number;
  amountPaid: number;
  amountDue: number;
  currency: string;
  orderDate: string;
  createdAt: string;
  updatedAt: string | null;
  couponCode: string | null;
  shippingOption: string | null;
  shippingAddress: NormalizedImportedShippingAddress | null;
  receiptReady: boolean;
  items: NormalizedImportedOrderItem[];
  importMetadata: Record<string, unknown>;
}

export interface NormalizedImportedProduct {
  sourcePlatform: 'bumpa';
  externalSourceId: string;
  title: string;
  description: string | null;
  sku: string | null;
  price: number;
  currency: string;
  stock: number | null;
  manageStock: boolean;
  status: 'active' | 'draft';
  images: string[];
  category: string | null;
  sourceCreatedAt: string | null;
  sourceUpdatedAt: string | null;
  importMetadata: Record<string, unknown>;
}

export interface ImportPreviewRow<TPayload> {
  rowNumber: number;
  sourceExternalId: string | null;
  rowStatus: ImportPreviewRowStatus;
  errors: string[];
  payload: TPayload | null;
  meta: Record<string, unknown>;
}

export interface ExistingImportedOrder {
  id: string;
  orderNumber: string;
  externalSource: string | null;
  externalId: string | null;
  updatedAt?: string | null;
}

export interface ExistingImportedProduct {
  id: string;
  name: string;
  sku: string | null;
  price: number | null;
  externalSource: string | null;
  externalId: string | null;
  status?: string | null;
}

export interface ExistingImportedCustomer {
  id: string;
  email: string | null;
  phone: string | null;
  userId: string | null;
}
