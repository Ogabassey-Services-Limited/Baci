-- Let signed-in storefront customers read the insurance policy attached to
-- their own orders, and give the customer tracking refresh route a narrow,
-- authenticated way to persist a carrier-confirmed delivery without exposing a
-- service-role client to a public request path.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "pg_policies"
    WHERE "schemaname" = 'public'
      AND "tablename" = 'order_insurance_policies'
      AND "policyname" = 'Customers can view own order insurance policies'
  ) THEN
    CREATE POLICY "Customers can view own order insurance policies"
      ON "public"."order_insurance_policies"
      FOR SELECT
      TO "authenticated"
      USING (
        EXISTS (
          SELECT 1
          FROM "public"."orders" "o"
          JOIN "public"."customers" "c" ON "c"."id" = "o"."customer_id"
          WHERE "o"."id" = "order_insurance_policies"."order_id"
            AND "c"."user_id" = (SELECT "auth"."uid"())
        )
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION "public"."persist_customer_delivered_tracking"(
  "p_shipment_id" "uuid",
  "p_order_id" "uuid",
  "p_current_location" "text" DEFAULT NULL,
  "p_estimated_delivery_at" timestamp with time zone DEFAULT NULL,
  "p_delivered_at" timestamp with time zone DEFAULT NULL,
  "p_tracking_events" "jsonb" DEFAULT '[]'::"jsonb"
)
RETURNS boolean
LANGUAGE "plpgsql"
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  "v_authorized" boolean;
  "v_order_status" text;
BEGIN
  SELECT TRUE INTO "v_authorized"
  FROM "public"."shipments" "s"
  JOIN "public"."orders" "o" ON "o"."id" = "s"."order_id"
  JOIN "public"."customers" "c" ON "c"."id" = "o"."customer_id"
  WHERE "s"."id" = "p_shipment_id"
    AND "o"."id" = "p_order_id"
    AND "c"."user_id" = (SELECT "auth"."uid"())
  LIMIT 1;

  IF "v_authorized" IS DISTINCT FROM TRUE THEN
    RETURN FALSE;
  END IF;

  UPDATE "public"."shipments"
  SET
    "status" = 'delivered',
    "current_location" = COALESCE("p_current_location", "current_location"),
    "estimated_delivery_at" = COALESCE("p_estimated_delivery_at", "estimated_delivery_at"),
    "delivered_at" = COALESCE("p_delivered_at", "delivered_at", now()),
    "tracking_events" = COALESCE("p_tracking_events", "tracking_events", '[]'::"jsonb"),
    "last_tracked_at" = now(),
    "updated_at" = now()
  WHERE "id" = "p_shipment_id"
    AND "order_id" = "p_order_id";

  UPDATE "public"."orders"
  SET "shipping_status" = 'delivered'
  WHERE "id" = "p_order_id"
    AND "shipping_status" NOT IN ('cancelled', 'canceled', 'returned', 'failed')
  RETURNING "shipping_status" INTO "v_order_status";

  RETURN "v_order_status" = 'delivered';
END;
$$;

REVOKE ALL ON FUNCTION "public"."persist_customer_delivered_tracking"(
  "uuid",
  "uuid",
  "text",
  timestamp with time zone,
  timestamp with time zone,
  "jsonb"
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."persist_customer_delivered_tracking"(
  "uuid",
  "uuid",
  "text",
  timestamp with time zone,
  timestamp with time zone,
  "jsonb"
) TO "authenticated";
