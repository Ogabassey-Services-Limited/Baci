# Admin (apps/mobile-admin) — E2E test plan — DEFERRED

> **Do not start this target until BOTH `storefront-web` and `storefront-app` are fully green**
> (every case `pass` or `knownIssue`). Storefront is tested first, by request.

> ⚠️ **PRODUCTION DATA — DO NOT SAVE SETTINGS.** This app is signed into the REAL merchant on the
> production database. NEVER tap Save/submit on Store settings, Social media, Profile, Payment methods,
> Sales channels, Shipping, Domains, or KYC — it overwrites live merchant data (this has already corrupted
> real social handles + support_email). Test forms up to Save, then back out without saving; settings
> write-path coverage requires a dedicated throwaway test merchant. See `e2e/prompt.md` → "Data safety".

**App under test:** Expo admin (`apps/mobile-admin`)
**Driver:** `mobile-mcp` on the emulator launched via the repo's mandated path.
**Launch (Android, required path per CLAUDE.md):**
`pnpm --filter baci-mobile-admin android:emulator` — this launcher owns GPU mode, Quick Boot, ADB
reset, boot wait, Metro reverse, and shell stability. Do **not** launch the emulator directly.

When this target activates, expand the cases below into a full plan mirroring the storefront-app
style (tabs, each screen, forms, cross-cutting). Seed flows to cover:

- Auth / login (`app/(auth)/login.tsx`)
- Tabs: orders, products, customers, menu, analytics
- Store settings, staff, KYC, payment-methods, sales-channels, shipping, domains
- Discounts, expenses, transactions, transaction-reconciliation
- Notifications, contact-support, help
- Cross-cutting: no red-box/crash, logcat hygiene, keyboard avoidance, back-nav, light/dark

Generate `status.json` cases from this plan when the loop reaches this target (keep the existing
seed case below until then).
