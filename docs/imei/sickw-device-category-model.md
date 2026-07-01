# IMEI/Device Checker — Sickw Device-Category Model

> Goal: restructure the checker from a flat "IMEI tiers" list into **Device category →
> (brand) → checks**, where the identifier input (IMEI vs serial) and the available
> checks adapt to the device. Single provider: **Sickw** (`sickw.com/api.php`).
> Petrock (a DHRU-Fusion panel) is deferred — can be added later as a routed 2nd source.

## The one technical unlock: serial-number input mode

Sickw's API takes **one `imei` parameter that also accepts a serial number** — the call in
`apps/web/.../sickw-client.ts` is identifier-agnostic. So "serial mode" is purely our own
validation relaxing, not a provider change. Today it's blocked in two spots:

- mobile `isValidIMEI`: `/^\d{15}$/` + Luhn → rejects serials
- web route: `imeiCheckSchema` + `isValidImeiChecksum()` → rejects serials

Apple serials are **8–12 alphanumeric** (newer: 10-char randomized). Plan: per-device
identifier rule — IMEI (15 digits + Luhn) for phones / cellular iPad; serial (alphanumeric,
8–14, no Luhn) for Mac/Watch/WiFi-iPad. The existing `serialInfo` TODO in
`service-tier-apple.ts:59` is exactly this gap.

## Data-model changes (`packages/shared/src/imei`)

Add to `ImeiServiceTierDefinition`:
- `deviceCategories: readonly ('smartphone'|'tablet'|'laptop'|'watch')[]`
- `identifier: 'imei' | 'serial' | 'both'`

Keep existing `brandScopes`. Drive the UI from these three fields.

## Device categories (top-level tabs)

| Category | Identifier | Brands surfaced |
|---|---|---|
| **Smartphone** | IMEI (iPhone can also serial) | Apple, Samsung, Xiaomi, Google, Oppo/OnePlus/Realme, Tecno/Infinix/Itel, Other |
| **Tablet (iPad)** | IMEI *(cellular)* or Serial *(WiFi)* | Apple only |
| **Laptop (Mac)** | Serial | Apple only |
| **Watch** | Serial | Apple only |

(AirPods deferred — thin Sickw coverage.)

## Curated checks per category (Sickw IDs · USD cost · proposed ₦)

> ₦ proposed from existing markup curve (~$0.10→₦1500, $0.30→₦5000, $0.50→₦8000).
> GSX Premium is genuinely costly upstream — priced as a premium tier. All ₦ = PROPOSED,
> business to confirm.

### Smartphone › Apple (iPhone) — IMEI
- ⭐ **Full Report** `[61]` carrier+FMI+blacklist · $0.10 · ₦1500
- **Find My / iCloud** `[3]` · $0.02 · ₦300
- **Blacklist / Stolen** `[54]` · $0.04 · ₦700  (Pro `[6]` $0.12 · ₦2000)
- **SIM-Lock** `[8]` · $0.025 · ₦500
- **Carrier** `[103]` · $0.06 · ₦1000
- **Activation (is it new?)** `[88]` · $0.04 · ₦700
- **MDM lock** `[81]` · $0.30 · ₦5000
- **Demo unit** `[85]` · $0.20 · ₦3300

### Smartphone › Samsung — IMEI
- **Samsung Info** `[80]` · $0.06 · ₦1000  · Pro `[1]` $0.10 · ₦1500
- **Knox Guard** `[82]` · $0.30 · ₦5000  *(new)*
- **Blacklist / Stolen** `[54]` · ₦700

### Smartphone › Xiaomi/Redmi/Poco — IMEI
- **Mi Lock On/Off** `[206]` · $0.10 · ₦1500
- **Mi Lock Clean/Lost** `[58]` · $0.50 · ₦8000
- **Blacklist** `[54]` · ₦700

### Smartphone › Google Pixel `[42]` ₦2000 · Oppo/OnePlus/Realme `[39]` ₦3300 · Tecno/Infinix/Itel `[45]` ₦500
### Smartphone › Other (Huawei `[15]`, Honor `[73]`, Vivo `[75]`, Motorola `[13]`, Nothing `[233]`, ZTE `[55]`)
- Fallback for any: **Brand & Model** `[203]` · $0.02 · ₦300 + **Blacklist** `[54]`

### Tablet (iPad) — IMEI or Serial
- ⭐ **iPad Report (GSX Premium)** `[63]` · $2.00 · ₦6000 *(premium)*
- **iCloud / Find My** `[3]`/`[4]` · ₦300/₦500
- **Activation Status** `[88]` · ₦700
- **MDM lock** `[81]` · ₦5000
- **Warranty & Repairs** `[68]` · $1.20 · ₦4000
- **Sold By & Country** `[27]` · $1.80 · ₦5000

### Laptop (Mac/MacBook) — Serial
- ⭐ **Mac Report (GSX Premium)** `[63]` · ₦6000
- **iCloud Lock (Mac)** `[110]` · $0.20 · ₦3300  (Clean/Lost `[66]` $0.22 · ₦3500)
- **MDM lock** `[81]` · ₦5000
- **Warranty & Repairs** `[68]` · ₦4000
- **Sold By & Country** `[27]` · ₦5000
- **Replacements History** `[29]` · $0.70 · ₦2000

### Watch (Apple Watch) — Serial
- ⭐ **Watch Report (GSX Premium)** `[63]` · ₦6000
- **Activation Status** `[88]`/`[101]` · ₦700
- **Warranty & Repairs** `[68]` · ₦4000
- **Sold By & Country** `[27]` · ₦5000

## Universal (any smartphone, all brands)
- **Brand & Model** `[203]` · ₦300 · **Worldwide Blacklist** `[54]`/`[6]` · IMEI⇄SN `[12]`

## Build phasing

**Phase 1 (ships fast, IMEI-capable):** data-model fields + serial-mode validation +
Smartphone & iPad categories with brand sub-filter. Mac/Watch shown as "Coming soon".
**Phase 2:** Mac + Watch serial categories + GSX/warranty/repairs result rendering
(parser additions: warranty, GSX cases, repair eligibility, replacements).
**Both platforms:** mobile (`apps/mobile-storefront/components/imei-check/*`) and web
(`apps/web/src/components/storefront/ogabassey/pages/imei-checker*`) need parity.

## Out of scope (for now)
- Petrock 2nd-provider routing (DHRU `imeiservicelist` catalog merge) — additive later.
- Carrier-unlock "premium" services ($2–$168) — not verification; separate product.
