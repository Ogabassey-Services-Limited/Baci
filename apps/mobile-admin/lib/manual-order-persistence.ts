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
  quantity: number;
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

function isMissingConditionColumnError(
  error: PostgrestError | null
): error is PostgrestError {
  return Boolean(error?.message?.includes(MISSING_CONDITION_COLUMN_MESSAGE));
}

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

function stripCondition(rows: OrderItemInsertRow[]): OrderItemInsertRow[] {
  return rows.map(({ condition: _condition, ...row }) => row);
}

async function insertOrderItemsWithConditionFallback(
  insertOrderItems: InsertOrderItems,
  rows: OrderItemInsertRow[]
): Promise<void> {
  const { error } = await insertOrderItems(rows);

  if (!error) {
    return;
  }

  if (!isMissingConditionColumnError(error)) {
    throw error;
  }

  console.warn(
    '[ManualOrderPersistence] order_items.condition is unavailable in the schema cache; retrying without the condition snapshot.'
  );

  const { error: retryError } = await insertOrderItems(stripCondition(rows));

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
    await insertOrderItemsWithConditionFallback(
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
