/**
 * Behavioural fake of the Supabase/PostgREST query builder for `orders`.
 *
 * A passthrough mock cannot catch an unbounded query: `.gte()`/`.limit()` are
 * no-ops, so a test asserting "the builder was called with a bound" stays
 * green even if the returned queue is unbounded. This fake actually applies
 * `gte`, `order` and `limit` to its fixture rows, so assertions can be made
 * on the rows the hook returns rather than on the calls it made.
 *
 * Deliberately partial: only the operators `useFailedOrders` uses are
 * modelled. `eq`/`or` are recorded but not evaluated — the fixture set is
 * assumed to be the already-matching rows for the merchant and status
 * predicate, which keeps the fake from re-implementing PostgREST.
 */

export interface FakeOrderRow {
  created_at: string;
  customer_email: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  id: string;
  order_number: string;
  payment_method: string;
  payment_status: string;
  total: number;
  transactions: Array<{
    gateway: string;
    gateway_response: Record<string, unknown> | null;
    status: string;
  }>;
}

export interface FakeQueryResult {
  data: FakeOrderRow[];
  error: { message: string } | null;
}

export interface RecordedCall {
  args: unknown[];
  method: string;
}

/** The subset of the PostgREST builder this fake models, fully typed so
 *  `await fake.from()...` resolves to a `FakeQueryResult` rather than
 *  `unknown`. */
export interface FakeOrderQuery extends PromiseLike<FakeQueryResult> {
  eq(...args: unknown[]): FakeOrderQuery;
  gte(column: string, value: string): FakeOrderQuery;
  limit(count: number): FakeOrderQuery;
  or(...args: unknown[]): FakeOrderQuery;
  order(column: string, options?: { ascending?: boolean }): FakeOrderQuery;
  select(...args: unknown[]): FakeOrderQuery;
}

interface Constraints {
  ascending: boolean;
  gte: { column: string; value: string } | null;
  limit: number | null;
  orderColumn: string | null;
}

function applyConstraints(
  rows: FakeOrderRow[],
  constraints: Constraints
): FakeOrderRow[] {
  let out = [...rows];

  if (constraints.orderColumn) {
    const column = constraints.orderColumn as keyof FakeOrderRow;
    out.sort((a, b) => {
      const left = String(a[column]);
      const right = String(b[column]);
      return constraints.ascending
        ? left.localeCompare(right)
        : right.localeCompare(left);
    });
  }

  if (constraints.gte) {
    const { column, value } = constraints.gte;
    out = out.filter(
      (row) => String(row[column as keyof FakeOrderRow]) >= value
    );
  }

  if (constraints.limit !== null) {
    out = out.slice(0, constraints.limit);
  }

  return out;
}

export function createSupabaseOrderQueryFake(initialRows: FakeOrderRow[] = []) {
  const calls: RecordedCall[] = [];
  let rows: FakeOrderRow[] = [...initialRows];
  let error: { message: string } | null = null;

  function makeChain(): FakeOrderQuery {
    const constraints: Constraints = {
      ascending: false,
      gte: null,
      limit: null,
      orderColumn: null,
    };

    const record =
      (method: string) =>
      (...args: unknown[]): FakeOrderQuery => {
        calls.push({ method, args });
        return chain;
      };

    const chain: FakeOrderQuery = {
      eq: record('eq'),
      or: record('or'),
      select: record('select'),

      gte: (column, value) => {
        calls.push({ method: 'gte', args: [column, value] });
        constraints.gte = { column, value };
        return chain;
      },

      limit: (count) => {
        calls.push({ method: 'limit', args: [count] });
        constraints.limit = count;
        return chain;
      },

      order: (column, options) => {
        calls.push({ method: 'order', args: [column, options] });
        constraints.orderColumn = column;
        constraints.ascending = options?.ascending ?? true;
        return chain;
      },

      // biome-ignore lint/suspicious/noThenProperty: models the thenable Supabase query builder
      then: (onfulfilled, onrejected) => {
        const result: FakeQueryResult = error
          ? { data: [], error }
          : { data: applyConstraints(rows, constraints), error: null };
        return Promise.resolve(result).then(onfulfilled, onrejected);
      },
    };

    return chain;
  }

  return {
    calls,
    from: () => makeChain(),
    reset: (nextRows: FakeOrderRow[] = initialRows) => {
      calls.length = 0;
      rows = [...nextRows];
      error = null;
    },
    setError: (nextError: { message: string } | null) => {
      error = nextError;
    },
    setRows: (nextRows: FakeOrderRow[]) => {
      rows = [...nextRows];
    },
  };
}
