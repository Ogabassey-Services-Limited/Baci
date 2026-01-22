## 2025-05-27 - Debug Endpoint Exposure
**Vulnerability:** An exposed debug endpoint (`/api/debug/supabase-check`) returned sensitive environment variables and configuration data (Supabase URL, merchant ID, credit direct keys) without authentication.
**Learning:** Debug endpoints created for temporary troubleshooting often get committed and forgotten, creating a significant security risk in production. The file explicitly said "DELETE THIS AFTER DEBUGGING" but remained.
**Prevention:** Enforce strict rules against committing debug endpoints. If needed, they must be behind a strong authentication (e.g., admin-only or dev-environment only checks). Use feature flags or ephemeral debugging tools instead.

## 2025-05-28 - Unverified Webhook Signature
**Vulnerability:** The MyCover webhook endpoint (`/api/webhooks/mycover`) lacked signature verification, allowing potential attackers to spoof policy updates or claim statuses.
**Learning:** Third-party webhooks often have varying documentation or header standards (e.g., Paystack vs MyCover). Assuming safety without explicit verification is risky. Even when documentation is scarce, implementing a "soft fail" logging mechanism is better than no visibility.
**Prevention:** Always implement signature verification for webhooks. If the algorithm/header is unknown, add a logging mechanism to capture headers and payloads in a secure environment to reverse-engineer or confirm the standard before enforcing blocking.
