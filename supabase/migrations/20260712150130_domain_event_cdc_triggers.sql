-- Selective, disabled-by-default CDC producers. Enable only after shadow gates.

CREATE OR REPLACE FUNCTION eventing.capture_product_domain_event_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '5s'
AS $$
DECLARE
  v_enabled boolean;
  v_shadow_only boolean;
  v_event_name text;
  v_row public.products%ROWTYPE;
  v_changed_fields text[];
BEGIN
  SELECT config.enabled, config.shadow_only INTO v_enabled, v_shadow_only
  FROM public.domain_event_producer_config AS config
  WHERE config.producer_key = 'catalog.products';
  IF COALESCE(v_enabled, false) = false THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  v_row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  v_event_name := CASE TG_OP
    WHEN 'INSERT' THEN 'catalog.product.created.v1'
    WHEN 'DELETE' THEN 'catalog.product.deleted.v1'
    ELSE 'catalog.product.updated.v1'
  END;

  IF TG_OP = 'UPDATE' THEN
    v_changed_fields := array_remove(ARRAY[
      CASE WHEN NEW.name IS DISTINCT FROM OLD.name THEN 'name' END,
      CASE WHEN NEW.price IS DISTINCT FROM OLD.price THEN 'price' END,
      CASE WHEN NEW.slug IS DISTINCT FROM OLD.slug THEN 'slug' END,
      CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'status' END,
      CASE WHEN NEW.category_id IS DISTINCT FROM OLD.category_id THEN 'category_id' END,
      CASE WHEN NEW.brand IS DISTINCT FROM OLD.brand THEN 'brand' END,
      CASE WHEN NEW.images IS DISTINCT FROM OLD.images THEN 'images' END,
      CASE WHEN NEW.compare_at_price IS DISTINCT FROM OLD.compare_at_price THEN 'compare_at_price' END,
      CASE WHEN NEW.manage_stock IS DISTINCT FROM OLD.manage_stock THEN 'manage_stock' END,
      CASE WHEN NEW.stock IS DISTINCT FROM OLD.stock THEN 'stock' END,
      CASE WHEN NEW.stock_quantity IS DISTINCT FROM OLD.stock_quantity THEN 'stock_quantity' END
    ]::text[], NULL);
    IF cardinality(v_changed_fields) = 0 THEN
      RETURN NEW;
    END IF;
  END IF;

  PERFORM *
  FROM eventing.enqueue_domain_event_v1(
    'database',
    'database',
    format(
      '%s:%s:%s:%s',
      v_event_name,
      v_row.id,
      pg_current_xact_id(),
      md5(jsonb_build_object(
        'name', v_row.name,
        'price', v_row.price,
        'slug', v_row.slug,
        'status', v_row.status,
        'category_id', v_row.category_id,
        'brand', v_row.brand,
        'images', v_row.images,
        'compare_at_price', v_row.compare_at_price,
        'manage_stock', v_row.manage_stock,
        'stock', v_row.stock,
        'stock_quantity', v_row.stock_quantity
      )::text)
    ),
    NULL,
    v_event_name,
    'product',
    v_row.id::text,
    v_row.merchant_id,
    jsonb_build_object(
      'schema', TG_TABLE_SCHEMA,
      'table', TG_TABLE_NAME,
      'operation', TG_OP
    ),
    jsonb_strip_nulls(jsonb_build_object(
      'product_id', v_row.id,
      'name', v_row.name,
      'slug', v_row.slug,
      'status', v_row.status,
      'price', v_row.price,
      'compare_at_price', v_row.compare_at_price,
      'brand', v_row.brand,
      'category_id', v_row.category_id,
      'manage_stock', v_row.manage_stock
    )),
    jsonb_build_object(
      'environment', 'database',
      'shadow_only', COALESCE(v_shadow_only, true)
    ),
    now(),
    v_changed_fields,
    NULL,
    NULL
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION eventing.capture_order_domain_event_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '5s'
AS $$
DECLARE
  v_enabled boolean;
  v_shadow_only boolean;
  v_event_name text;
  v_changed_fields text[];
BEGIN
  SELECT config.enabled, config.shadow_only INTO v_enabled, v_shadow_only
  FROM public.domain_event_producer_config AS config
  WHERE config.producer_key = 'commerce.orders';
  IF COALESCE(v_enabled, false) = false THEN
    RETURN NEW;
  END IF;

  v_changed_fields := array_remove(ARRAY[
    CASE WHEN NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN 'payment_status' END,
    CASE WHEN NEW.shipping_status IS DISTINCT FROM OLD.shipping_status THEN 'shipping_status' END
  ]::text[], NULL);
  IF cardinality(v_changed_fields) = 0 THEN
    RETURN NEW;
  END IF;

  v_event_name := CASE
    WHEN NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM 'paid'
      THEN 'commerce.order.paid.v1'
    WHEN NEW.payment_status = 'cancelled' OR NEW.shipping_status = 'cancelled'
      THEN 'commerce.order.cancelled.v1'
    ELSE 'commerce.order.status_changed.v1'
  END;

  PERFORM *
  FROM eventing.enqueue_domain_event_v1(
    'database',
    'database',
    format(
      '%s:%s:%s:%s',
      v_event_name,
      NEW.id,
      pg_current_xact_id(),
      md5(jsonb_build_object(
        'payment_status', NEW.payment_status,
        'shipping_status', NEW.shipping_status
      )::text)
    ),
    NULL,
    v_event_name,
    'order',
    NEW.id::text,
    NEW.merchant_id,
    jsonb_build_object(
      'schema', TG_TABLE_SCHEMA,
      'table', TG_TABLE_NAME,
      'operation', TG_OP
    ),
    jsonb_build_object(
      'order_id', NEW.id,
      'order_number', NEW.order_number,
      'previous_payment_status', OLD.payment_status,
      'payment_status', NEW.payment_status,
      'previous_shipping_status', OLD.shipping_status,
      'shipping_status', NEW.shipping_status,
      'total', NEW.total,
      'currency', NEW.currency
    ),
    jsonb_build_object(
      'environment', 'database',
      'shadow_only', COALESCE(v_shadow_only, true)
    ),
    now(),
    v_changed_fields,
    NULL,
    NULL
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION eventing.capture_transaction_domain_event_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '5s'
AS $$
DECLARE
  v_enabled boolean;
  v_shadow_only boolean;
BEGIN
  SELECT config.enabled, config.shadow_only INTO v_enabled, v_shadow_only
  FROM public.domain_event_producer_config AS config
  WHERE config.producer_key = 'payments.transactions';
  IF COALESCE(v_enabled, false) = false
    OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  PERFORM *
  FROM eventing.enqueue_domain_event_v1(
    'database',
    'database',
    format(
      'payments.transaction.status_changed.v1:%s:%s:%s',
      NEW.id,
      pg_current_xact_id(),
      md5(NEW.status)
    ),
    NULL,
    'payments.transaction.status_changed.v1',
    'transaction',
    NEW.id::text,
    NEW.merchant_id,
    jsonb_build_object(
      'schema', TG_TABLE_SCHEMA,
      'table', TG_TABLE_NAME,
      'operation', TG_OP
    ),
    jsonb_build_object(
      'transaction_id', NEW.id,
      'order_id', NEW.order_id,
      'transaction_type', NEW.transaction_type,
      'previous_status', OLD.status,
      'status', NEW.status,
      'gateway', NEW.gateway,
      'amount', NEW.amount,
      'currency', NEW.currency
    ),
    jsonb_build_object(
      'environment', 'database',
      'shadow_only', COALESCE(v_shadow_only, true)
    ),
    now(),
    ARRAY['status']::text[],
    NULL,
    NULL
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION eventing.capture_product_domain_event_v1()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION eventing.capture_order_domain_event_v1()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION eventing.capture_transaction_domain_event_v1()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS capture_product_domain_event_insert_delete_v1
  ON public.products;
CREATE TRIGGER capture_product_domain_event_insert_delete_v1
AFTER INSERT OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION eventing.capture_product_domain_event_v1();

DROP TRIGGER IF EXISTS capture_product_domain_event_update_v1
  ON public.products;
CREATE TRIGGER capture_product_domain_event_update_v1
AFTER UPDATE OF
  name,
  price,
  slug,
  status,
  category_id,
  brand,
  images,
  compare_at_price,
  manage_stock,
  stock,
  stock_quantity ON public.products
FOR EACH ROW EXECUTE FUNCTION eventing.capture_product_domain_event_v1();

DROP TRIGGER IF EXISTS capture_order_domain_event_v1 ON public.orders;
CREATE TRIGGER capture_order_domain_event_v1
AFTER UPDATE OF payment_status, shipping_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION eventing.capture_order_domain_event_v1();

DROP TRIGGER IF EXISTS capture_transaction_domain_event_v1 ON public.transactions;
CREATE TRIGGER capture_transaction_domain_event_v1
AFTER UPDATE OF status ON public.transactions
FOR EACH ROW EXECUTE FUNCTION eventing.capture_transaction_domain_event_v1();
