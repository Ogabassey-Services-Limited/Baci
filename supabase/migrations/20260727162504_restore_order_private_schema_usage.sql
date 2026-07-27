-- Public storefront RPCs are SECURITY INVOKER wrappers around explicitly
-- granted private implementations. The payment-vault migration revoked schema
-- USAGE from browser roles, so those wrappers can no longer resolve their
-- private functions and every order creation fails with PostgreSQL 42501.
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

-- Schema USAGE permits object lookup only. Keep the BYOK credential vault
-- inaccessible to every Data API role; its public SECURITY DEFINER accessors
-- remain the only credential read/write boundary.
REVOKE ALL ON TABLE private.merchant_payment_credentials
  FROM PUBLIC, anon, authenticated, service_role;
