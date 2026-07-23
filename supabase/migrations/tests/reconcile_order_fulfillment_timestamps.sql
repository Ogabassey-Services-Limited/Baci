BEGIN;

DO $$
DECLARE
  v_column record;
  v_expected_column text;
BEGIN
  FOR v_expected_column IN
    SELECT column_name
    FROM (
      VALUES
        ('shipped_at'::text),
        ('delivered_at'::text)
    ) AS expected(column_name)
  LOOP
    SELECT
      col.data_type,
      col.is_nullable,
      col.column_default
    INTO v_column
    FROM information_schema.columns AS col
    WHERE col.table_schema = 'public'
      AND col.table_name = 'orders'
      AND col.column_name = v_expected_column;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'public.orders.% fulfillment timestamp is missing',
        v_expected_column;
    END IF;

    IF v_column.data_type IS DISTINCT FROM 'timestamp with time zone'
      OR v_column.is_nullable IS DISTINCT FROM 'YES'
      OR v_column.column_default IS NOT NULL
    THEN
      RAISE EXCEPTION
        'public.orders.% must be nullable timestamptz with no default',
        v_expected_column;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

ROLLBACK;
