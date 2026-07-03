# Baci Mobile-Storefront — Checkout DELIVERY Step Premium Redesign Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement task-by-task. Each phase below can be expanded into bite-sized TDD steps at execution time.

**Goal:** Bring the checkout DELIVERY step (Step 1 of 3) to visual + architectural parity with the already-shipped, user-approved PAYMENT step — calm single-accent red, one radius scale, shared selection primitives, info nested under the selection.

**Architecture:** Presentation-only. Extract shared selection primitives into `components/checkout/selection/`, then reskin each delivery card to consume them. State machines / hooks / submit flow stay byte-identical.

**Tech Stack:** Expo SDK 56 / RN 0.85, expo-router, StyleSheet, React Compiler (no manual memo), ESLint (mobile), Jest + RTL, strict TS.

---

**Scope:** `apps/mobile-storefront/components/checkout/*` (delivery/Step-1 surfaces) — bring the DELIVERY step to visual + architectural parity with the shipped PAYMENT step (`components/checkout/payment-method-selector/*`). Presentation-only: state machines, hooks (`use-checkout-address-state.ts`, `use-checkout-saved-addresses.ts`, `use-checkout-shipping.ts`), RHF wiring, and the `CheckoutBottomAction` flow stay behaviorally identical.

---

## 1. Goal & Design Principles

The payment step is the source of truth. Its calm-red discipline (audited in `payment-method-selector/PaymentIntentAccordion.tsx`, `PaymentMethodOptionRow.tsx`, `PaymentMethodStoreCreditRows.tsx`, `styles.ts`) becomes the delivery contract:

**Calm-red rule — red (`BRAND.primary` = `#DC2626`) appears in exactly these places, nowhere else:**
1. **Selection border** on a first-class card/row: `borderColor: selected ? BRAND.primary : colors.border` (2px).
2. **Radio fill**: 22px outer ring (border 2, radius 11) goes red on select; 12px inner dot (radius 6) is a solid red fill only when selected — neutral otherwise.
3. **Informational badge tag**: pill with `${BRAND.primary}20` (~12.5%) background + solid red 11px/700 text (the "Default" badge, "Popular"-style tags).
4. **The one sanctioned "always-red" exception** — reserved for calling attention to something valuable/unused (in payment: store-credit indicator). Delivery has no equivalent; do **not** invent one.

**Never-red elements (must be neutral):** header icon chips, chevrons (`colors.textSecondary` — chevron signals open/closed, not selection), icon glyphs (toggle `colors.text` ↔ `colors.textSecondary` only), dividers (`colors.border`/hairline), unselected borders, metadata (carrier/ETA/address lines stay `colors.textSecondary` always), **and activity indicators** — the `ActivityIndicator` color at `SavedAddressOptions.tsx:58` (`BRAND.primary`) and `ShippingQuotesCard.tsx:64` (`colors.primary`, the same amber-in-dark bug class) both become `colors.textSecondary`. Spinners are not selection.

**Three previously-unaudited red spots (rulings, per Fable review):**
- **Edit/Done affordance** (`CheckoutContactCard.styles.ts:94-98`, currently red icon + red text) → **neutral** `colors.textSecondary`. It is a utility control, not a selection; red stays reserved for the choice being made.
- **Activity indicators** → neutral (above).
- **Segmented "Saved / New address" toggle** (§3.8) → **neutral elevated-chip** treatment (iOS-style: active chip = raised `colors.card`/subtle fill on a `colors.muted` track, neutral text), **not** red border+text. The plan itself calls it "a filter, not a CTA" — so it must not introduce a third red vocabulary.

**Tint discipline:** When a selected state would otherwise nest a red border inside an already-red-bordered ancestor, use `BRAND.primaryAlpha06` (6% red tint) as the fill instead of a second border (the `nested` rule from `PaymentMethodOptionRow.tsx:44-53`). The parallel "quiet" convention for non-selection chips is neutral `${colors.textSecondary}10`.

**One radius scale** (`constants/Colors.ts:31-40`): `sm 4, md 8, lg 10, xl 12, 2xl 16, 3xl 24, full 9999`. Rectangles pull from the scale; circles compute `width/2` by hand. **Eliminate every off-scale literal** currently in delivery (14, 18, 20). Adopt payment's tiering: outer selectable card `RADIUS.lg` (10), icon chip `RADIUS.md` (8), slim-row `RADIUS.md` (8).

**Two visual weight classes:**
- **Primary selectable unit** — 2px border, `SPACING.md` (16) padding, 44–48px icon chip / 22–24px glyph, 15px title / 13px meta.
- **Slim modifier row** — `StyleSheet.hairlineWidth` border, `SPACING.sm` (8) padding, 30px icon chip / 18px glyph, 14px / 12px type.

**Single-open accordion mechanics** (from `PaymentIntentAccordion.tsx:100-133`): `open` is derived **purely** from `selected` plus an ephemeral `collapsedSelected` toggle that self-resets via `useEffect` on selection change. No separate "expanded" state. Selecting one option auto-collapses the previous because `selected` flips false. Info nests under the selected option; selection persists.

**One alpha helper:** all soft-red tints go through `withAlpha(BRAND.primary, x)` or a precomputed token (`BRAND.primaryAlpha06`, plus new `BRAND.primaryAlpha12`). Kill every `${BRAND.primary}18/14`, bespoke `rgba(217,59,48,0.14)` (which isn't even `red[600]`'s rgb), and hardcoded `#EF4444/#F9FAFB/#111827`.

**Calm motion (new principle, per Fable review).** Payment collapses/expands instantly; on delivery that would read as a glitch, not choreography — especially Phase 6 folding an entire address form. So we add a *quiet* motion layer, built into the shared primitives so payment can inherit it in the §5 reconciliation PR:
- A single **layout transition (~180–200ms, ease-out)** on `SelectableOptionRow` / `CollapsibleCheckoutCard` expand & collapse (Reanimated is already in the app — see `useBottomSheetAnimation`; use `Layout`/`LinearTransition` or a measured height animation).
- A **scale-in on the `SelectionRadio` dot** when it becomes selected.
- Respect reduce-motion (`AccessibilityInfo.isReduceMotionEnabled`) → fall back to instant.
- **Motion is a hard prerequisite of Phase 6**, not an afterthought.

**Copy restraint (free premium win, per Fable review).** Payment has no per-section helper sentences; delivery stacks three explanatory layers (step header + per-card helper like `DeliveryMethodCard.tsx:87-89` "Choose how you want to receive this order." + row subtitles). Cut the per-card helper lines; let titles + subtitles carry it.

---

## 2. Unified Selection System (shared primitives)

The real design-system win: **payment and delivery share primitives**, not two look-alikes. Extract into a new `apps/mobile-storefront/components/checkout/selection/` directory so both `payment-method-selector/` and the delivery cards consume them.

### 2.1 `SelectionRadio` (token + tiny component)
- **Source:** `payment-method-selector/styles.ts:86-100` and `:194-208` are byte-identical (`radioOuter`/`radioInner` vs `intentRadioOuter`/`intentRadioInner`) — collapse into one.
- **New file:** `selection/SelectionRadio.tsx` (+ `SelectionRadio.styles.ts`). Props: `{ selected: boolean; size?: 20 | 22 }`. Renders the 22px ring / 12px red-fill dot. `borderRadius` computed as `size/2`.
- **Consumers:** `PaymentMethodOptionRow`, `PaymentIntentAccordion` terminal cards (replace inline blocks), and delivery's new `SelectableOptionRow`.
- **Replaces** the `checkmark-circle`/`ellipse-outline` Ionicon idiom currently in `DeliveryMethodCard.tsx:142-146`, `ShippingQuotesCard.tsx:171-175`, `SavedAddressOptions.tsx:216-220` — unify on the radio ring so "selected" is one vocabulary across the whole checkout.

### 2.2 `SelectableOptionRow` (the core "pick one" primitive)
- **New file:** `selection/SelectableOptionRow.tsx` (+ `.styles.ts`, + `.test.tsx`).
- **Props:**
  ```ts
  interface SelectableOptionRowProps {
    selected: boolean;
    disabled?: boolean;
    nested?: boolean;              // inside an already-red-bordered ancestor → tint, no border
    onPress: () => void;
    icon?: keyof typeof Ionicons.glyphMap;   // neutral chip glyph
    title: string;
    subtitle?: string;             // ALWAYS colors.textSecondary
    trailing?: React.ReactNode;    // price, badge
    children?: React.ReactNode;    // expandedInfo panel, rendered only when selected
    accessibilityLabel?: string;
  }
  ```
- **Surface prop (fix, per Fable review):** these rows sit *inside* a `colors.card` `CheckoutSectionCard`, so a `colors.card` row background is card-on-card — invisible in light mode (this is exactly why `DeliveryMethodCard.tsx:107` uses `colors.background` today). Add `surface?: 'card' | 'background'` defaulting to `'background'` for rows rendered inside section cards. Bake the correct default in so Phase 3 doesn't flatten every row and get "fixed" ad hoc.
- **Selection styling — single accent:** border `selected && !nested ? BRAND.primary : colors.border`; background `selected && nested ? BRAND.primaryAlpha06 : <surface>`; **title stays `colors.text`, subtitle/meta/price stay neutral**; the only colored element is the border and the `SelectionRadio` dot. This directly fixes the 5–6-property recolor in `DeliveryMethodCard.tsx:99-146` and `ShippingQuotesCard.tsx:90-175`.
- **Radius:** row `RADIUS.lg` (10), matching `payment-method-selector/styles.ts:38` `methodCard`. Kills the 12-vs-18 divergence.
- **Accessibility:** `accessibilityRole="radio"`, `accessibilityState={{ checked: selected, disabled }}`; the list wrapper gets `accessibilityRole="radiogroup"`.
- **Consumers:** `DeliveryMethodCard` rows, `ShippingQuotesCard` quotes, `SavedAddressOptions` rows. (Payment's `PaymentMethodOptionRow` stays as-is initially but should be reconciled toward this in a later cleanup — see §5; do **not** rewrite it in phase 1 or payment tests churn.)

### 2.3 `CheckoutSectionCard` (card shell + header)
- **New file:** `selection/CheckoutSectionCard.tsx` (+ `.styles.ts`). Replaces the four hand-rolled identical StyleSheet blocks in `DeliveryMethodCard.tsx`, `PickupStationCard.tsx`, `ShippingQuotesCard.tsx`, `DeliveryNotesCard.tsx` and the shared `CheckoutDeliveryCard.styles.ts`.
- **Props:** `{ icon; title; action?: ReactNode; children; overflowVisible?: boolean }`. `action` is the optional Edit/Done control.
- **Chrome (single source of truth):** `borderRadius RADIUS.xl` (12), `borderWidth 1`, `borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'transparent'` (adopt the Delivery card's borderless/shadow-only light treatment for **all** cards — fixes the Contact-vs-Delivery border mismatch at `CheckoutContactCard.tsx:72` vs `CheckoutDeliveryCard.tsx:53`), `SHADOWS.sm`, `paddingHorizontal SPACING.md`, `paddingTop 14`, `paddingBottom SPACING.md`, `marginBottom SPACING.sm`.
- **Header icon:** neutral `colors.textSecondary` (not `BRAND.primary`) — reserves red for selection.
- `overflowVisible` prop threads the `overflow: 'visible'` requirement for dropdowns so we don't lose that behavior. **Two call sites need it (per Fable review), not one:** `CheckoutDeliveryCard` (AddressAutocomplete dropdown) **and** `CheckoutContactCard.tsx:73-76` (the `PhoneInput` country dropdown, `overflow:'visible'` + `zIndex:20`). Missing the Contact one in the Phase 2 shell swap clips phone entry — add a Phase 2 test asserting both cards pass `overflowVisible`.

### 2.4 `CollapsibleCheckoutCard` (accordion + summary)
- **New file:** `selection/CollapsibleCheckoutCard.tsx`. Wraps `CheckoutSectionCard`, adds the Edit/Done toggle + collapsed summary-panel pattern currently duplicated across `CheckoutContactCard.tsx` and `CheckoutDeliveryCard.tsx`.
- **Props:** `{ icon; title; collapsed; canCollapse; onToggle; summary: ReactNode; children }`.
- **Summary panel chrome:** align to `SHADOWS.sm` (fix the flat-`colors.muted` elevation gap noted for `ContactSummary`), radius `RADIUS['2xl']` (16, down from off-scale 18).

### 2.5 `CheckoutCheckbox` (the "red checkbox")
- **New file:** `selection/CheckoutCheckbox.tsx`. Extracts the 22×22 / `borderWidth 2` box with solid `BRAND.primary` fill + `BRAND.onPrimary` checkmark from `CheckoutDeliveryCard.styles.ts:38-53`.
- **Radius exception (per Fable review):** keep the checkbox corner at **4–6px, NOT `RADIUS.md` (8)** — an 8px radius on a 22px box reads as a near-squircle and visually collides with the 22px radio *ring*, blurring the exact radio-vs-checkbox-vs-badge vocabulary this section establishes. Document the 4px as a deliberate exception (a documented exception beats false token purity).
- **Consumers:** `CheckoutDeliveryDefaultCheckbox.tsx` and the hand-copied block in `CheckoutGuestSaveDetails.tsx:41-55`. The red-checkbox is the sanctioned **action** affordance (set-as-default, save-details) — distinct from the radio (mutually-exclusive selection) and the `DefaultBadge` (read-only status). Document this three-way vocabulary in the component header.

### 2.6 `DefaultBadge`
- **New file:** `selection/DefaultBadge.tsx`. Pill: `RADIUS.full`, `backgroundColor: withAlpha(BRAND.primary, 0.12)`, text `BRAND.primary` 11px/700. Replaces `SavedAddressOptions.tsx:189-205` and any inline default-pill. Read-only status only.

### 2.7 `useSectionScrollIntoView` (reused hook)
- **Reuse `payment-method-selector/use-intent-scroll-into-view.ts` directly** if the optional accordion phase (§4 Phase 6) ships. Key `expandedKey` off the delivery-method selection. Do not re-derive scroll-follow logic.

### 2.8 Token additions (`constants/Colors.ts`)
- Add `BRAND.primaryAlpha12 = withAlpha(palette.red[600], 0.12)` (for badges/tints) alongside existing `BRAND.primaryAlpha06`.
- No new radius tokens needed — the existing scale covers every case once literals are removed. (Optionally rename the picker sheet's magic `20` → `RADIUS['3xl']` 24; see §3.9.)

---

## 3. Per-Component Redesign (before → after)

### 3.1 Container — `CheckoutAddressStepView.tsx`
- **Now:** single `ScrollView`, plain-text section header, five cards stacked with per-card `marginBottom`. Structurally fine.
- **After:** no structural change to the scroll flow or prop threading (keep ~40 props / hooks intact — money-critical). Only swaps children to the new shared components. Keep the `addressScrollOffsetRef`/`scrollRef` wiring for `AddressAutocomplete`. The plain-text header stays (documented as intentional in the audit).

### 3.2 `DeliveryMethodCard.tsx`
- **Before:** own card StyleSheet (radius 12); rows at `borderRadius 18`; selection recolors border+bg+title+price+icon all red via hardcoded `BRAND.primary`/`palette.red[50]`/`rgba(217,59,48,0.14)`; header icon always red; `expandedInfo` at magic `borderRadius 14`.
- **After:**
  - Wrap in `CheckoutSectionCard` (neutral `colors.textSecondary` header icon).
  - Each method → `SelectableOptionRow` (radius `RADIUS.lg` 10, single-accent border + `SelectionRadio`, title `colors.text`, price/helper `colors.textSecondary`).
  - `expandedInfo` panel rendered as `children` of the selected row, radius `RADIUS.md` (8) < row radius (10) < card (12) — correct outer>inner decrease. Tint via `BRAND.primaryAlpha06` (or neutral) — not bespoke rgba.
  - This card becomes the **single-open accordion** driver for delivery methods: only the selected method's info panel is expanded (already its native behavior — now formalized through the shared row).

### 3.3 `ShippingQuotesCard.tsx` — **nest quotes under the Door row (Fable review, top priority)**
This is the change that makes delivery feel *designed* rather than *repainted*, and it is the true structural analogue of payment (intent → nested instrument rows).

- **Before:** two cards render one decision. `DeliveryMethodCard`'s "Door delivery" row shows `doorPrice`/`doorSubtitle` that are *derived from the selected quote* (`CheckoutAddressStepView.tsx:208-215`), while a **separate** `ShippingQuotesCard` below is what actually changes that quote. Quote rows key off themed `colors.primary` (red in light, **amber in dark** — a real cross-component hue bug), radius literal 12, recolor six properties incl. `quoteMeta`.
- **After:** **merge them.** The shipping-quote list becomes the `expandedInfo`/`children` of the selected **Door delivery** row inside `DeliveryMethodCard` — same nesting mechanic as payment's instruments-under-intent. Remove the standalone `ShippingQuotesCard` sibling render at `CheckoutAddressStepView.tsx`; the "choose a courier" decision lives where the price it sets is shown.
  - Quote rows → `SelectableOptionRow` (`nested`, so tint-not-border), accent standardized on `BRAND.primary` (kills the red/amber split). `quoteMeta` (carrier/ETA) **always `colors.textSecondary`** (drop the `isSelected` ternary at `:151-154`).
  - **Loading choreography (per Fable):** while quotes load, render **2–3 skeleton rows shaped like `SelectableOptionRow`** (kills the lurch when quotes arrive), and the Door row's price slot shows **"Calculating…"** instead of the dangling `'—'` at `CheckoutAddressStepView.tsx:214` (the least-premium pixel on the screen today).
  - **ETA hierarchy (per Fable):** commit to one ETA format (e.g. `Est. 2–3 days`) and delete the "ETA unavailable" fallback soup at `ShippingQuotesCard.tsx:79-83`.
  - **"Free" as the sanctioned badge (per Fable):** the Pickup row's `Free` price renders as the §1-rule-3 `primaryAlpha12` tinted badge (the one legitimate, rule-compliant delight moment) rather than plain price text — this finally uses the badge slot the plan otherwise leaves empty on delivery.
  - `ShippingQuotesRetryCard` (§3.4) still renders inline in the quote-list slot on failure.
  - **State parity:** `onSelectQuote`/`selectedQuoteId`/`useSectionScrollIntoView` wiring is untouched — this is a re-parenting of presentation, not a state change. Verify the quote list receives the same handlers it does today.

### 3.4 `ShippingQuotesRetryCard.tsx`
- **Before:** best-in-class calm amber, but `borderWidth 2` dashed and hardcoded `'#111827'` at `:54`.
- **After:** keep the amber single-accent restraint. Replace `'#111827'` → `colors.text`. Keep `borderWidth 2` dashed **but** document in a header comment that 2px-dashed is the reserved retry/error affordance (so it doesn't read as drift). Card radius `RADIUS['2xl']` (16), icon wrap `RADIUS.full` — already tokenized, leave.

### 3.5 `PickupStationCard.tsx` — resolve the duplicate render
- **Before:** renders `PICKUP_STATION_ADDRESS_LINES` in a whole separate card with a red header icon, **duplicating** the same lines already shown inline by `DeliveryMethodCard.tsx:178-208` `expandedInfo` when pickup is selected. Two styles, back-to-back.
- **After (decision):** **Drop the standalone `PickupStationCard` render** at `CheckoutAddressStepView.tsx:219-221`. Keep the pickup address as the `expandedInfo` `children` of the selected pickup row inside `DeliveryMethodCard` (bold first line + `BRAND.primaryAlpha06`/neutral tinted box, `RADIUS.md`). One presentation, no red duplication.
- Extract `PICKUP_STATION_ADDRESS_LINES` + a small `PickupAddressBlock` presentational component so the remaining call site is a single shared block. Remove the now-unused `PickupStationCard` (and delete/retire its test), or keep `PickupAddressBlock` as its replacement export.

### 3.6 `CheckoutContactCard.tsx` + `CheckoutDeliveryCard.tsx`
- **Before:** duplicate the icon-header + Edit/Done + collapsed-summary shape; Contact's Done affordance hidden from guests; Contact card uses visible `colors.border`, Delivery uses transparent; summary panels at radius 18 with flat `colors.muted`, no shadow.
- **After:**
  - Both consume `CollapsibleCheckoutCard`.
  - **Extend Edit/Done to guests** once contact fields are valid (mirror `hasContactIdentity` independent of `isAuthenticated`) so the section self-collapses like Delivery — fixes the "perpetually in-progress" feel. *(Presentation of an existing capability; verify it does not alter submit/validation state.)*
  - Unified card border (borderless/shadow-only both cards). Summary panel gets `SHADOWS.sm`, radius `RADIUS['2xl']` (16).
  - **Collapsed summary shows the FULL, untruncated address (per Fable):** it is the customer's receipt of the step — no ellipsis on the address lines.
  - **Submit-time errors re-open a collapsed section (per Fable):** if validation fails on a field inside a collapsed Contact/Delivery card, that card must auto-expand and scroll to the first error (reuse `useSectionScrollIntoView`). This rule applies whether or not Phase 6 ships.
  - `CheckoutDeliveryCard` keeps its `overflow: visible` + z-index scaffolding via the `overflowVisible` prop on `CheckoutSectionCard`. (Generalizing the in-scroll-dropdown into a reusable hook is noted as a **stretch**, not required — see §5.)

### 3.7 Fields — `CheckoutFormField.tsx`, `AddressAutocomplete`, `CheckoutDeliveryLocationPicker.tsx`
- **Before:** three independent copies of the input recipe; **focus border = `BRAND.primary` red**, so focused ≠ error is indistinguishable; `CheckoutDeliveryLocationPicker` hardcodes `'#F9FAFB'` and `'#EF4444'`; `AddressAutocomplete` label weight 500 vs 600 elsewhere.
- **After:**
  - Extract shared `checkout-field.styles.ts` (input/label/fieldError/inputGroup) consumed by all three.
  - **Focus ring becomes neutral** — `isFocused ? withAlpha(colors.text, ~0.35) : colors.border`; **red reserved for `colors.error` only**. This is the single most impactful "calm" fix for fields: tapping into City/Email no longer looks like a validation error.
  - Input radius → `RADIUS.xl` token (not literal 12).
  - `CheckoutDeliveryLocationPicker`: `'#F9FAFB'` → `palette.gray[50]`, `'#EF4444'` → `colors.error`.
  - `AddressAutocomplete` label weight → 600.

### 3.8 `SavedAddressOptions.tsx`
- **Before:** rows stack **four** red channels (bg tint + border + 38px icon-wrap tint + checkmark icon), radius literal 14; segmented toggle is a **solid 100% red chip**; default pill via `${BRAND.primary}14` string-concat; icon-wrap via `${BRAND.primary}18`.
- **After:**
  - Rows → `SelectableOptionRow` (1–2 channels: border + `SelectionRadio` only, or `nested` tint-only if inside the Delivery card frame). Icon-wrap stays neutral `${colors.textSecondary}10`.
  - Segmented "Saved / New address" toggle → **tint fill** (`BRAND.primaryAlpha06` or `palette.red[50]`) + `BRAND.primary` border/text for the active chip, radius `RADIUS['2xl']` (16) — no solid-red block (it's a filter, not a CTA).
  - "Default" → `DefaultBadge` component.
  - All `${BRAND.primary}NN` → `withAlpha(BRAND.primary, x)`.

### 3.9 `pickers/CheckoutLocationPickers.tsx` + `CheckoutScreenView.styles.ts`
- **Before:** bottom-sheet radius literal `20` (off-scale); city search focus border `BRAND.primary`.
- **After (per Fable):** prefer adding a documented `RADIUS.sheet = 20` token over snapping this large surface to `RADIUS['3xl']` (24) purely for purity — bumping a full-height sheet's corner is a visible change made for no design reason. If snapping to 24, verify on device first. City-search focus border → neutral ring (match §3.7 field focus rule). Amber "use typed city" affordance stays. Low priority — bundle into the field phase.

### 3.10 `DeliveryNotesCard.tsx`
- **Before:** already the calmest — neutral shell, neutral header icon, red only as `CheckoutFormField` focus (which §3.7 neutralizes further).
- **After:** swap shell to `CheckoutSectionCard` for token unification; otherwise **the template**, minimal change. Its "red only on the one active/error signal" discipline is the north star for every other file.

### 3.11 Summary panels (collapsed Contact/Delivery)
- Aligned via `CollapsibleCheckoutCard` (§2.4): `SHADOWS.sm`, radius `RADIUS['2xl']`, `DefaultBadge` for the default-address pill.

---

## 4. Phased Implementation (TDD, each phase shippable)

Guard commands after **every** phase (mobile-storefront uses **ESLint, not Biome**):
```bash
# from apps/mobile-storefront: ESLint the touched files
pnpm exec eslint <changed files>
# repo root:
pnpm turbo typecheck
pnpm --filter @baci/mobile-storefront exec jest <changed test paths>
```
Each new component gets a colocated `*.test.tsx` (Jest + RTL) written **before** implementation. Keep every file ≤ 300 lines.

### Phase 0 — Tokens (no visual change)
- **Files:** `constants/Colors.ts`.
- **Do:** add `BRAND.primaryAlpha12`. Grep-confirm `withAlpha` export.
- **Test:** `Colors.test.ts` — `primaryAlpha12` equals `withAlpha(palette.red[600], 0.12)`; `primaryAlpha06` unchanged.
- Ships instantly; zero UI risk.

### Phase 1 — Shared primitives (built + tested in isolation, not yet wired)
- **New files (each + `.styles.ts` + `.test.tsx`):** `selection/SelectionRadio.tsx`, `selection/CheckoutSectionCard.tsx`, `selection/CheckoutCheckbox.tsx`, `selection/DefaultBadge.tsx`, `selection/SelectableOptionRow.tsx`, `selection/CollapsibleCheckoutCard.tsx`.
- **Test each:**
  - `SelectionRadio` — renders red ring+dot when `selected`, neutral otherwise; radius = size/2.
  - `SelectableOptionRow` — selected border red when `!nested`; `BRAND.primaryAlpha06` bg + neutral border when `selected && nested`; title always `colors.text`; subtitle always `colors.textSecondary`; `onPress` fires; `accessibilityState.checked` tracks `selected`; disabled dims + blocks press; renders `children` only when selected.
  - `CheckoutSectionCard` — neutral header icon; `overflowVisible` sets `overflow:'visible'`.
  - `CheckoutCheckbox` — checked = solid red fill + checkmark; toggles via `onPress`; `accessibilityRole="checkbox"`.
  - `DefaultBadge` — text + `withAlpha` bg, no press handler.
  - `CollapsibleCheckoutCard` — collapsed renders `summary`, expanded renders `children`; Edit/Done toggle fires `onToggle`; hidden when `!canCollapse`.
- **Motion built in, not bolted on (§1):** `SelectableOptionRow` and `CollapsibleCheckoutCard` include the ~180–200ms ease-out layout transition on expand/collapse and the `SelectionRadio` scale-in, gated behind a reduce-motion check that falls back to instant. Test both branches (motion on → animates; reduce-motion → instant). This is what lets payment inherit motion in the §5 reconciliation PR.
- **Nothing consumes them yet → app unchanged, fully shippable.**

### Phase 2 — Card-shell unification (low-risk chrome swap)
- **Files:** `DeliveryMethodCard.tsx`, `ShippingQuotesCard.tsx`, `DeliveryNotesCard.tsx`, `PickupStationCard.tsx`, `CheckoutContactCard.tsx`, `CheckoutDeliveryCard.tsx` (+ delete redundant local card StyleSheet blocks; retire the card subset of `CheckoutDeliveryCard.styles.ts`).
- **Do:** wrap each in `CheckoutSectionCard`; neutralize all header icons to `colors.textSecondary`; unify card borders. No selection-logic change yet.
- **Test:** update each card's existing test to assert neutral header icon + shared shell; add/keep render tests. Confirm no behavior change.

### Phase 3 — Selection rows + quote nesting (the visual heart)
- **Files:** `DeliveryMethodCard.tsx`, `ShippingQuotesCard.tsx`, `CheckoutAddressStepView.tsx` (remove the standalone `ShippingQuotesCard` sibling render).
- **Do:**
  - Replace hand-rolled rows with `SelectableOptionRow` + `SelectionRadio`. `DeliveryMethodCard` accent = `BRAND.primary`; quote rows accent standardized to `BRAND.primary` (kills red/amber dark-mode split). Meta/price → neutral.
  - **Nest the quote list under the selected Door row** (§3.3) — quotes render as the Door row's `children`; airport/pickup `expandedInfo` likewise become selected-row `children` at `RADIUS.md`.
  - Loading skeleton rows + "Calculating…" door price; one ETA format (drop the fallback soup); Pickup "Free" → `primaryAlpha12` badge.
- **Test:** `DeliveryMethodCard.test.tsx` — selecting a method sets its row `checked`, unselects siblings, shows nested content only for the selected row, title/price stay neutral, border is the sole red; selecting a nested quote updates the Door row's displayed price. `ShippingQuotesCard.test.tsx` — quote selection parity; `quoteMeta` never colored; skeletons render while loading; the list renders inside the Door row (not as a sibling card). Regression test: selection accent is `BRAND.primary` (no themed `colors.primary`) in both light & dark. Budget the `selected`→`checked` a11y assertion updates here (§5).

### Phase 4 — Pickup de-duplication
- **Files:** `CheckoutAddressStepView.tsx` (remove `PickupStationCard` render at `:219-221`), new `PickupAddressBlock.tsx` (+ test), remove/retire `PickupStationCard.tsx` + its test.
- **Do:** pickup address renders once, as the selected-row `children` in `DeliveryMethodCard`.
- **Test:** `CheckoutAddressStepView.test.tsx` — when `deliveryMethod === 'pickup_station'`, the address lines render **exactly once**; `PickupAddressBlock.test.tsx` — bold first line + tinted box.
- **Money-critical caution:** confirm no shipping/quote/state branch keyed off `PickupStationCard`'s presence.

### Phase 5 — Fields, checkboxes, saved addresses, badges
- **Files:** shared `checkout-field.styles.ts` (new), `CheckoutFormField.tsx`, `AddressAutocomplete.styles.ts`, `CheckoutDeliveryLocationPicker.tsx`, `CheckoutDeliveryDefaultCheckbox.tsx`, `CheckoutGuestSaveDetails.tsx`, `SavedAddressOptions.tsx`, `pickers/CheckoutLocationPickers.tsx`, `CheckoutScreenView.styles.ts`.
- **Do:** neutral focus ring (red = error only); hardcoded hex → tokens; label weight 600; `CheckoutCheckbox` in both checkbox call sites; `SavedAddressOptions` rows → `SelectableOptionRow` (1–2 channels), segmented toggle → tint-fill, `DefaultBadge`; all `${BRAND.primary}NN` → `withAlpha`; sheet radius → `RADIUS['3xl']`.
- **Test:** `CheckoutFormField.test.tsx` — focused-valid field border ≠ `BRAND.primary` and ≠ `colors.error`; error state = `colors.error`. `SavedAddressOptions.test.tsx` — selected row exposes `checked`, at most border+radio colored, meta neutral; toggle active chip is tint (not solid red); `DefaultBadge` present for default address. `CheckoutCheckbox` shared by both checkbox tests. **Contact guest Done affordance:** test that a guest with valid contact fields sees the Edit/Done toggle and can collapse.

### Phase 6 — Single-open accordion + collapse-completed-sections (IN SCOPE, user-confirmed)
> Changes the *container* progressive-disclosure model (not the state machine). Carries the most UX/scroll risk, so it ships **last** and **requires the §1 motion layer** — an instant full-form collapse reads as a glitch, not choreography (Fable review). Phases 0–5 stand alone if this ever needs to be reverted.

- **Files:** `CheckoutAddressStepView.tsx`, reuse `payment-method-selector/use-intent-scroll-into-view.ts` (rename generic → `useSectionScrollIntoView` or import directly).
- **Do:** make Contact / Delivery / Delivery-Method a **single-open accordion** — completed sections collapse to their summary (via `CollapsibleCheckoutCard`), only the active section is expanded, entered data persists. Wire scroll-into-view keyed off the active section so a collapsing sibling never pushes the active card under the fixed header/stepper (`STEPPER_STACK_HEIGHT`), and **animate the collapse/expand** (§1 motion).
- **Completion semantics (Fable — the plan's biggest hole, now closed). Auto-collapse fires ONLY on discrete, intentional events:**
  - explicit **Done** tap, **saved-address selection**, or **autocomplete address selection**.
  - **NEVER** on keystroke-validity (a guest's email is "valid" at `a@b.co` mid-typing) and **never** on blur (fights the keyboard). Advancing is always user-initiated.
- **Error handling:** a submit-time validation error inside a collapsed section **auto-expands it and scrolls to the first error** (shared with §3.6 — holds even without Phase 6).
- **Static vs. accordion members:** Contact / Delivery / Delivery-Method participate in the accordion; the Notes card (and the retry/error cards) stay static. Give static cards a subtly distinct treatment (e.g. no chevron affordance) so a static card never reads as a broken accordion row.
- **Test:** a *Done tap* on valid Contact collapses it and expands Delivery (typing alone does NOT collapse); re-tapping a collapsed header re-expands without data loss; a forced submit error in a collapsed section re-opens it and scrolls to the error; reduce-motion falls back to instant; scroll-follow no-ops when `scrollRef` absent.

---

## 5. Risks & Sequencing Notes

- **Money-critical / behavior parity is non-negotiable.** This is presentation-only. Do **not** touch `use-checkout-address-state.ts`, `use-checkout-saved-addresses.ts`, `use-checkout-shipping.ts`, quote selection (`selectedQuoteId`), or the `CheckoutBottomAction` gating. Every phase must leave the submit path and state transitions byte-identical. The Pickup de-dup (Phase 4) is the one place a render removal could accidentally drop a state dependency — grep for `PickupStationCard` usages and any `deliveryMethod`-keyed branch before deleting.
- **Payment tests must stay green.** `SelectionRadio` (§2.1) is the only phase-1 primitive that *could* touch payment (it dedupes `radioOuter`/`intentRadioOuter`). **Recommendation:** in phases 0–5, build `SelectionRadio` for delivery only and **do not** refactor `PaymentMethodOptionRow`/`PaymentIntentAccordion` to consume it. Reconciling payment onto the shared radio is a separate, clearly-scoped follow-up PR with the payment suite as the gate — keeps blast radius small and avoids churning the reference implementation mid-redesign. Same for `SelectableOptionRow`: delivery adopts it now; payment reconciliation is deferred.
- **Refactor risk of shared primitives.** Extracting `CheckoutSectionCard`/`SelectableOptionRow` from 6+ call sites is where subtle drift (radius, padding, dark-mode border) creeps in. Mitigate by (a) snapshot/style assertions in each primitive's test, and (b) doing the shell swap (Phase 2) separately from the selection swap (Phase 3) so a regression is bisectable to one concern.
- **300-line cap watch.** `CheckoutDeliveryCard.tsx`, `SavedAddressOptions.tsx`, and `DeliveryMethodCard.tsx` are the fattest files and gain/lose code during extraction. After Phase 3/5, verify each is ≤ 300 lines; the extractions (`PickupAddressBlock`, shared styles, `SelectableOptionRow`) should net-reduce them. If `CheckoutDeliveryCard.tsx` stays over, split the new-address form into a child component.
- **Theme correctness.** The red/amber divergence fix (Phase 3) means both selection surfaces now use constant `BRAND.primary`. Verify in **both** light and dark that no delivery selection surface still resolves through themed `colors.primary`/`colors.primaryLowOpacity` — add the regression assertion noted in Phase 3.
- **Dropdown escape behavior.** `CheckoutDeliveryCard`'s `overflow:visible` + z-index scaffolding for `AddressAutocomplete` must survive the `CheckoutSectionCard` wrap (thread via `overflowVisible`). Generalizing it into a reusable in-scroll-dropdown hook is a **stretch**, explicitly out of scope for this redesign — noted only so it isn't lost.
- **A11y test churn (per Fable review).** Moving rows from `accessibilityRole="button"` + `accessibilityState.selected` to `radio` + `checked` is a real screen-reader improvement (announces position-in-group) but breaks every existing `selected`-based assertion in `DeliveryMethodCard.test.tsx` / `ShippingQuotesCard.test.tsx` / `SavedAddressOptions.test.tsx`. Budget the assertion updates into Phases 3 & 5 — it is expected churn, not surprise breakage.
- **Quote re-parenting (Phase 3, per Fable).** Merging `ShippingQuotesCard` into the Door row's nested slot is the highest-value change but also re-parents a live selection list. Before/after, confirm the quote rows receive the identical `onSelectQuote`/`selectedQuoteId` and that `CheckoutBottomAction` still gates on `selectedQuoteId` for door delivery. Add a test that selecting a quote inside the nested slot updates the Door row's displayed price.
- **Shippability ordering.** Phases 0→5 are each independently shippable and additive; Phase 1 primitives sit unused until Phase 2+ wires them, so a partial landing never breaks checkout. Phase 6 is **in scope** (user-confirmed) and ships last because it depends on the §1 motion layer and the shared `CollapsibleCheckoutCard`.