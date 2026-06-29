-- Keep customer-triggered delivered-state persistence callable from the
-- request-scoped authenticated client instead of a service-role client. The
-- function still runs as SECURITY DEFINER for the narrow orders/shipments
-- update, but it verifies auth.uid() inside the function before writing.

CREATE OR REPLACE FUNCTION "public"."persist_customer_delivered_tracking"(
  "p_shipment_id" "uuid",
  "p_order_id" "uuid",
  "p_customer_user_id" "uuid",
  "p_current_location" "text" DEFAULT NULL,
  "p_estimated_delivery_at" timestamp with time zone DEFAULT NULL,
  "p_delivered_at" timestamp with time zone DEFAULT NULL,
  "p_tracking_events" "jsonb" DEFAULT '[]'::"jsonb"
)
RETURNS boolean
LANGUAGE "plpgsql"
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  "v_authenticated_user_id" uuid := (SELECT "auth"."uid"());
  "v_authorized" boolean;
  "v_order_status" text;
BEGIN
  IF "v_authenticated_user_id" IS NULL OR
     "p_customer_user_id" IS DISTINCT FROM "v_authenticated_user_id" THEN
    RETURN FALSE;
  END IF;

  SELECT TRUE INTO "v_authorized"
  FROM "public"."shipments" "s"
  JOIN "public"."orders" "o" ON "o"."id" = "s"."order_id"
  JOIN "public"."customers" "c" ON "c"."id" = "o"."customer_id"
  WHERE "s"."id" = "p_shipment_id"
    AND "o"."id" = "p_order_id"
    AND "c"."user_id" = "v_authenticated_user_id"
  LIMIT 1;

  IF "v_authorized" IS DISTINCT FROM TRUE THEN
    RETURN FALSE;
  END IF;

  SELECT "shipping_status" INTO "v_order_status"
  FROM "public"."orders"
  WHERE "id" = "p_order_id"
  FOR UPDATE;

  IF "v_order_status" IN ('cancelled', 'canceled', 'returned', 'failed') THEN
    RETURN FALSE;
  END IF;

  UPDATE "public"."orders"
  SET "shipping_status" = 'delivered'
  WHERE "id" = "p_order_id"
    AND "shipping_status" NOT IN ('cancelled', 'canceled', 'returned', 'failed')
  RETURNING "shipping_status" INTO "v_order_status";

  IF "v_order_status" IS DISTINCT FROM 'delivered' THEN
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shipment % for order % was not updated', "p_shipment_id", "p_order_id";
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION "public"."persist_customer_delivered_tracking"(
  "uuid",
  "uuid",
  "uuid",
  "text",
  timestamp with time zone,
  timestamp with time zone,
  "jsonb"
) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."persist_customer_delivered_tracking"(
  "uuid",
  "uuid",
  "uuid",
  "text",
  timestamp with time zone,
  timestamp with time zone,
  "jsonb"
) FROM "anon", "authenticated", "service_role";

GRANT EXECUTE ON FUNCTION "public"."persist_customer_delivered_tracking"(
  "uuid",
  "uuid",
  "uuid",
  "text",
  timestamp with time zone,
  timestamp with time zone,
  "jsonb"
) TO "authenticated";
