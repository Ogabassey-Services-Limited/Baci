## 2025-05-27 - Debug Endpoint Exposure
**Vulnerability:** An exposed debug endpoint (`/api/debug/supabase-check`) returned sensitive environment variables and configuration data (Supabase URL, merchant ID, credit direct keys) without authentication.
**Learning:** Debug endpoints created for temporary troubleshooting often get committed and forgotten, creating a significant security risk in production. The file explicitly said "DELETE THIS AFTER DEBUGGING" but remained.
**Prevention:** Enforce strict rules against committing debug endpoints. If needed, they must be behind a strong authentication (e.g., admin-only or dev-environment only checks). Use feature flags or ephemeral debugging tools instead.

## 2025-05-27 - Wallet Withdrawal API Bypass
**Vulnerability:** The wallet withdrawal endpoint (`POST /api/wallet/withdraw`) was fully functional despite the frontend UI explicitly disabling withdrawals (`canWithdraw: false`). An attacker could bypass the UI restriction by calling the API directly.
**Learning:** Disabling a feature in the UI does not disable it in the backend. API endpoints must enforce the same feature flags or logic as the frontend to prevent broken access control.
**Prevention:** Always enforce business rules (like "withdrawals disabled") in the API layer, not just the presentation layer. Use a shared feature flag or configuration for both.
