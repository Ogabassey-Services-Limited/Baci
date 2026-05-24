import type { PostgrestError } from '@supabase/supabase-js';

interface CreateOrderResult {
  id: string;
}

interface OrderItemInsertRow {
  condition?: string | null;
  item_description?: string | null;
  name: string;
  order_id: string;
  price: number;
  product_id: string | null;
  product_match_status?: 'custom' | 'linked' | 'unreviewed';
  quantity: number;
  variant_id?: string | null;
  variant_name?: string | null;
}

type DeleteOrder = (
  orderId: string
) => PromiseLike<{ error: PostgrestError | null }>;

type InsertOrder<TOrder extends Record<string, unknown>> = (
  order: TOrder
) => PromiseLike<{
  data: CreateOrderResult | null;
  error: PostgrestError | null;
}>;

type InsertOrderItems = (
  rows: OrderItemInsertRow[]
) => PromiseLike<{ error: PostgrestError | null }>;

const MISSING_CONDITION_COLUMN_MESSAGE =
  "Could not find the 'condition' column of 'order_items' in the schema cache";
const MISSING_PRODUCT_MATCH_STATUS_COLUMN_MESSAGE =
  "Could not find the 'product_match_status' column of 'order_items' in the schema cache";

type OptionalOrderItemInsertColumn = 'condition' | 'product_match_status';

function isPostgrestError(error: unknown): error is PostgrestError {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string' &&
      'code' in error &&
      typeof error.code === 'string' &&
      (!('details' in error) ||
        error.details === null ||
        typeof error.details === 'string') &&
      (!('hint' in error) ||
        error.hint === null ||
        typeof error.hint === 'string')
  );
}

function getMissingOrderItemInsertColumns(
  error: PostgrestError | null
): OptionalOrderItemInsertColumn[] {
  const missingColumns: OptionalOrderItemInsertColumn[] = [];

  if (error?.message?.includes(MISSING_CONDITION_COLUMN_MESSAGE)) {
    missingColumns.push('condition');
  }

  if (error?.message?.includes(MISSING_PRODUCT_MATCH_STATUS_COLUMN_MESSAGE)) {
    missingColumns.push('product_match_status');
  }

  return missingColumns;
}

function stripOrderItemInsertColumns(
  rows: OrderItemInsertRow[],
  columns: OptionalOrderItemInsertColumn[]
): OrderItemInsertRow[] {
  return rows.map((row) => {
    const nextRow = { ...row };

    for (const column of columns) {
      delete nextRow[column];
    }

    return nextRow;
  });
}

async function insertOrderItemsWithMissingColumnFallback(
  insertOrderItems: InsertOrderItems,
  rows: OrderItemInsertRow[]
): Promise<void> {
  const { error } = await insertOrderItems(rows);

  if (!error) {
    return;
  }

  const missingColumns = getMissingOrderItemInsertColumns(error);

  if (missingColumns.length === 0) {
    throw error;
  }

  console.warn(
    `[ManualOrderPersistence] order_items columns are unavailable in the schema cache (${missingColumns.join(
      ', '
    )}); retrying without them.`
  );

  const { error: retryError } = await insertOrderItems(
    stripOrderItemInsertColumns(rows, missingColumns)
  );

  if (retryError) {
    throw retryError;
  }
}

async function rollbackIncompleteOrder(
  deleteOrder: DeleteOrder,
  orderId: string,
  cause: PostgrestError
): Promise<void> {
  const { error } = await deleteOrder(orderId);

  if (!error) {
    return;
  }

  throw new Error(
    `${cause.message}. Cleanup failed for incomplete order ${orderId}: ${error.message}`
  );
}

export async function createManualOrderWithItems<
  TOrder extends Record<string, unknown>,
>(
  dependencies: {
    deleteOrder: DeleteOrder;
    insertOrder: InsertOrder<TOrder>;
    insertOrderItems: InsertOrderItems;
  },
  payload: {
    buildItems: (orderId: string) => OrderItemInsertRow[];
    order: TOrder;
  }
): Promise<CreateOrderResult> {
  const { data, error } = await dependencies.insertOrder(payload.order);

  if (error) {
    throw error;
  }

  if (!data?.id) {
    throw new Error('Order creation did not return an id');
  }

  try {
    await insertOrderItemsWithMissingColumnFallback(
      dependencies.insertOrderItems,
      payload.buildItems(data.id)
    );
  } catch (error: unknown) {
    if (isPostgrestError(error)) {
      await rollbackIncompleteOrder(dependencies.deleteOrder, data.id, error);
    }

    throw error;
  }

  return data;
}
