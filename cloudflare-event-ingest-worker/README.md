# Baci Event Ingest Worker

Cloudflare Worker for reducing Vercel Function invocations from low-value
analytics traffic.

The first production rule is intentionally conservative: only `page_view`
events are inserted directly into Supabase from Cloudflare. All conversion-like
events, including product views, search, add-to-cart, wishlist, checkout, and
purchase events, are forwarded to the existing `/api/events` route so the
current server-side ad-platform fan-out keeps running on Vercel.

Required bindings:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ORIGIN_EVENTS_URL`

Production route:

- `ogabassey.com/api/events`
