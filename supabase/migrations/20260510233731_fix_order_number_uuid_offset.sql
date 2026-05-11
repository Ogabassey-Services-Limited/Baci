-- Fix merchant UUID offsets that collapse generated order numbers to 0000.
--
-- The previous implementation cast the first 32 bits of merchant_uuid to a
-- signed integer before applying modulo. UUID prefixes with the high bit set
-- could produce a negative offset large enough to make next_seq <= 0, and
-- encode_base32_crockford only encodes positive values.
--
-- This migration was applied directly to production on 2026-05-10 23:37 UTC
-- and committed to the repo retroactively (B1 setup discovered the prod-only
-- migration during `supabase db push --linked`). Body is verbatim from
-- `supabase_migrations.schema_migrations`.
CREATE OR REPLACE FUNCTION "public"."generate_improved_order_number"("merchant_uuid" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
    prefix TEXT;
    date_part TEXT;
    next_seq INTEGER;
    merchant_offset INTEGER;
    seq_encoded TEXT;
    base_order TEXT;
    check_digit CHAR;
    final_order TEXT;
    today DATE := CURRENT_DATE;
BEGIN
    IF merchant_uuid IS NULL THEN
        RAISE EXCEPTION 'merchant_uuid cannot be null';
    END IF;

    SELECT COALESCE(order_prefix, 'ORD') INTO prefix
    FROM public.merchants
    WHERE id = merchant_uuid;

    IF prefix IS NULL THEN
        prefix := 'ORD';
    END IF;

    date_part := TO_CHAR(today, 'YYMMDD');

    INSERT INTO public.merchant_daily_counters (merchant_id, date_key, last_sequence)
    VALUES (merchant_uuid, today, 1)
    ON CONFLICT (merchant_id, date_key)
    DO UPDATE SET last_sequence = public.merchant_daily_counters.last_sequence + 1
    RETURNING last_sequence INTO next_seq;

    merchant_offset := (
        ('x' || SUBSTRING(REPLACE(merchant_uuid::TEXT, '-', ''), 1, 8))::BIT(32)::BIGINT % 1000
    )::INTEGER;

    next_seq := next_seq + merchant_offset;
    seq_encoded := public.encode_base32_crockford(next_seq);

    base_order := prefix || '-' || date_part || '-' || seq_encoded;
    check_digit := public.calculate_order_check_digit(base_order);
    final_order := base_order || '-' || check_digit;

    RETURN final_order;
END;
$$;

ALTER FUNCTION "public"."generate_improved_order_number"("merchant_uuid" "uuid") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."generate_improved_order_number"("merchant_uuid" "uuid") IS 'Generates human-readable order numbers in format PREFIX-YYMMDD-XXXX-C using a non-negative UUID-derived merchant offset.';
