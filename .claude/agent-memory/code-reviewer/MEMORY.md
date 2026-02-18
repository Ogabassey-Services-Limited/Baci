# Code Review Memory - Baci Project

## Common Review Patterns Found

### Security Issues
1. **Fail Closed Pattern**: Dev override gates should require secret exists AND matches (not treat missing as valid)
   - Changed: `!expectedSecret || match` → `expectedSecret && match`
   - File: `apps/web/src/app/api/merchant/blog/upload/route.ts`

2. **CSRF Protection**: Client-side POST requests need CSRF tokens
   - Import: `getClientCsrfToken` from `@/lib/csrf`
   - Add header: `x-csrf-token` with token value
   - File: `apps/web/src/components/blog/novel-features/image-upload.ts`

### Error Handling
1. **Promise Resolve + Throw**: Never resolve() then throw in same path
   - Causes: Promise resolves, then .catch fires unexpectedly
   - Fix: Remove throw after resolve for 401 fallback cases
   - File: `apps/web/src/components/blog/novel-features/image-upload.ts`

2. **Nested Ternaries**: Replace with lookup maps for readability
   - Pattern: Error message → status/response mapping
   - File: `apps/web/src/app/api/staff/accept-invite/route.ts`

### Data Validation
1. **NaN Safety**: Check `Number.isFinite()` before math operations
   - File: `apps/web/src/app/api/payments/webhook/route.ts`
   - Function: `getVerifiedAmount()`

2. **Case-Insensitive Comparison**: Use `.toUpperCase()` for currency codes
   - File: `apps/web/src/app/api/payments/webhook/route.ts`

3. **Null Guards**: Always guard link params that can be null
   - Pattern: `orderId ? <Link href={...orderId...} /> : null`
   - File: `apps/web/src/app/(storefront)/[slug]/order-success/page.tsx`

### Dead Code
1. **Redundant Ternaries**: Both branches same value
   - File: `apps/web/src/app/api/newsletter/subscribe/route.ts`
   - Fixed: Removed ternary, used single value

### Logging Best Practices
1. **Warn on Null Amounts**: Log when payment verification returns null
   - Helps debugging webhook issues
   - Files: `apps/web/src/app/api/payments/webhook/route.ts` (2 locations)

### Supabase Client Factory Pattern
1. **Server Factory Required**: Always use `@/lib/supabase/server` in API routes
   - Pattern: `const supabase = createClient(await cookies())`
   - Never: Direct `createClient` from `@supabase/supabase-js`
   - Files: `apps/web/src/app/api/payments/credit-direct/sign/route.ts`

2. **Unauthenticated Endpoints**: Add explanatory comment
   - Comment: "This is an unauthenticated endpoint for storefront checkout"
   - Still uses server factory with RLS-protected RPCs

### Type Safety & Runtime Validation
1. **No Unsafe Assertions**: Replace `as string` with runtime checks
   - Pattern: `if (typeof value !== 'string' || !value) return error`
   - File: `apps/web/src/app/api/payments/credit-direct/sign/route.ts` (merchant_id)

2. **Number Conversion Gotchas**:
   - `Number(null)` returns `0` (falsy but NOT NaN!)
   - `Number(undefined)` returns `NaN`
   - Fix: Check `value == null || Number.isNaN(num) || num <= 0`
   - Files: `apps/web/src/app/api/payments/{initialize,credit-direct/sign}/route.ts`

### Performance & Code Quality
1. **nanoid Uppercase**: Use `customAlphabet` instead of `.toUpperCase()`
   - Bad: `nanoid(12).toUpperCase()`
   - Good: `customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 12)()`
   - File: `apps/web/src/app/api/payments/initialize/route.ts`

## Review Checklist Applied (2026-02-06)
- TypeScript strict mode: ✓ All fixes type-safe
- No `any` types: ✓ Removed unsafe assertions, added runtime checks
- Security: ✓ CSRF added, fail-closed pattern fixed, proper Supabase client
- Error handling: ✓ Promise logic corrected, lookup maps used
- Input validation: ✓ NaN checks, null/undefined guards, case-insensitive comparison
- Logging: ✓ Warnings added for null cases
- Supabase: ✓ Server factory pattern enforced
- Code quality: ✓ Efficient nanoid usage

## mobile-storefront ChatWidget Patterns (2026-02-17)

### Architecture
- ChatWidget in `components/chat/ChatWidget.tsx` — single file, 1099 lines (exceeds 300-line limit)
- UI state: `stores/ui-store.ts` (Zustand) — `isChatOpen`, `chatInitialMessage`, `openChat`, `closeChat`
- API targets: `apps/web/src/app/api/chat/route.ts` (agentic, non-streaming) and `/api/chat/santa` (streaming via AI SDK)
- Widget mounted in `app/_layout.tsx` at root level alongside `NegotiationModal`

### Known Bugs Found

1. **Stale `messages` closure in `handleSend`** (HIGH)
   - `messages` captured at callback creation time; races possible when two sends overlap
   - Fix: capture messages before adding user message using a ref, or use functional state getter

2. **`_value` internal API access** (HIGH)
   - Lines 164-165, 186-187: `(pan.x as unknown as { _value: number })._value`
   - This is an undocumented React Native Animated internal that can break on RN version changes
   - Fix: Use Reanimated 2/3 `useSharedValue` for edge-snapping FAB (already noted in comment)

3. **Module-level `Dimensions.get('window')` — no resize listener** (MEDIUM)
   - Line 64: dimensions captured once at module load time
   - FAB snap/position breaks after orientation change or window resize
   - Fix: Use `Dimensions.addEventListener('change', ...)` or `useWindowDimensions()` hook

4. **Nudge timer leak — `timerId` variable shadowing** (MEDIUM)
   - In the nudge effect, `timerId` is a `let` in the outer scope but re-assigned inside closures
   - The cleanup `clearTimeout(timerId)` only clears the last outer assignment; nested setTimeout chains persist after unmount
   - Fix: Use a ref (`nudgeTimerRef`) so cleanup always cancels the live timer

5. **Non-streaming consumer for streaming response** (HIGH)
   - `/api/chat/santa` uses `streamText` + `toTextStreamResponse()` — streams AI SDK protocol frames
   - ChatWidget reads raw bytes with a plain `TextDecoder` — will show SSE protocol garbage in the UI
   - `/api/chat` (non-santa) uses `generateText` + plain `text/plain` — works correctly with the current reader
   - Fix: Either use the AI SDK `useChat` hook on mobile, or switch santa route to `generateText` (non-streaming)

6. **`openChat(undefined)` breaks `chatInitialMessage` clearing** (LOW)
   - Line 440: `useUIStore.getState().openChat(undefined)` — calls openChat which sets `isChatOpen: true` again
   - Intended to clear `chatInitialMessage` but instead re-triggers the auto-send effect
   - Fix: Add a dedicated `clearChatInitialMessage` action to UIStore, or call `closeChat()` then don't re-set

7. **Hardcoded merchant ID in two places with different values** (HIGH, api/chat/santa)
   - `route.ts`: `OGABASSEY_MERCHANT_ID = '6b5cb8a4-5575-456c-b936-8cdfae30db74'`
   - `product/route.ts`: `OGABASSEY_MERCHANT_ID = '063f1367-a2f2-4ec3-a626-d183050c99a0'`
   - Two different UUIDs for the same constant — data inconsistency/wrong products served
   - Fix: Extract to shared env var or shared constant

8. **`sanitize-html.ts` in mobile-storefront strips HTML tags but doesn't sanitize plain text XSS** (LOW)
   - Used in ChatWidget to sanitize AI response before displaying as `<Text>` (plain text, not HTML)
   - In React Native `<Text>`, HTML tags are shown as literal strings, not rendered
   - `sanitizeHtml` is harmless but not meaningful here; the actual risk is if response is ever rendered in `HTMLRenderer`
   - Note: server-side `sanitizeHtml` in chat routes is correct and meaningful

9. **NegotiationModal: hardcoded merchant_id** (HIGH)
   - Line 189-190 in `NegotiationModal.tsx`: `merchant_id: '868f0fdc-5654-469b-9807-695ca1206d20'` hardcoded
   - Unauthenticated `supabase` client insert with no auth check
   - Attackers can spam `negotiation_requests` table with arbitrary data (no rate limiting, no auth)
   - Fix: Add rate limiting, validate merchant_id from store config, or require auth for submissions

10. **`session_id: 'mobile-session'` — no real session tracking** (MEDIUM)
    - NegotiationModal sends static string for session_id, making analytics useless
    - Fix: Generate a stable per-session UUID (AsyncStorage or auth user ID)

## Receipts/Invoices Feature Review (2026-02-18)

### Architecture
- Shared HTML generator: `packages/shared/src/receipt/generate-receipt-html.ts` (~800 lines, types + escapeHtml + sanitizeSvg exported from `index.ts`)
- Mobile storefront: `types/receipt.ts` + `hooks/use-receipts.ts` + `components/receipts/ReceiptPreviewModal.tsx` + `app/receipts/index.tsx`
- Web storefront (ogabassey): `components/ReceiptModal.tsx` + `pages/receipts.tsx`

### Patterns Confirmed Good
- React Query used correctly for data fetching in mobile hooks
- Auth guard: `useRequireAuth()` declarative pattern (Redirect component, not imperative push)
- WebView uses `originWhitelist={['about:blank']}` + `mixedContentMode="never"` (safe)
- `escapeHtml()` used in the shared generator before injecting user data into HTML

### Known Issues Found

1. **`useEffect` receipt-generation race** (HIGH, `app/receipts/index.tsx` lines 95-148)
   - `isGenerating` flag reset in useEffect; if user taps two items fast, the second tap's detail
     may arrive and render before first effect cleanup runs — two modals can sequence incorrectly
   - Fix: Compare `selectedOrderId` inside the effect instead of `isGenerating` boolean flag

2. **Duplicate local interface vs shared type** (MEDIUM, web `ReceiptModal.tsx` lines 13-84)
   - `ReceiptOrderData` and `ReceiptMerchantData` are hand-rolled duplicates of `ReceiptOrder`/`ReceiptMerchant`
   - They differ subtly (e.g., `items` array missing `id` field, `virtual_account` optional vs required)
   - Fix: Import and use `ReceiptOrder`/`ReceiptMerchant` directly from `@baci/shared` as the prop types

3. **Web receipts page: no auth redirect** (HIGH, `pages/receipts.tsx` line 41)
   - `isAuthenticated` from `useCustomerAuth()` checked to skip fetch, but no redirect to login
   - Unauthenticated users see an empty loading spinner forever
   - Fix: Add redirect to login when `!isAuthenticated`

4. **Web receipts: uses wrong query param key** (HIGH, `pages/receipts.tsx` line 64)
   - Fetches `/api/storefront/orders?merchant_slug=...` but `route.ts` line 14 reads `merchantSlug`
   - The slug never matches → route always returns 400 "Merchant slug is required"
   - Fix: Change fetch to `?merchantSlug=${merchantContext.merchant.slug}`

5. **Missing transaction/virtual_account fields in web API response** (MEDIUM, `pages/receipts.tsx`)
   - `/api/storefront/orders` does not return `transactions`, `virtual_account`, `balance`, `tax_amount`, etc.
   - The web `rawOrder` mapping silently defaults these to 0/null → receipt HTML missing payment history
   - Fix: Either add a separate `/api/storefront/orders/[id]` call for full detail, or expand the list API

6. **No test files for new code** (WARNING — project rule)
   - `ReceiptModal.tsx`, `receipts.tsx` (web), `ReceiptPreviewModal.tsx`, `use-receipts.ts`, `app/receipts/index.tsx` all lack colocated test files

7. **WebView `javaScriptEnabled` on receipt content** (MEDIUM, `ReceiptPreviewModal.tsx` line 123)
   - HTML is generated server-side from trusted templates BUT merchant-supplied data (product names, etc.)
     goes through `escapeHtml()` in the generator — content is safe
   - However `javaScriptEnabled={true}` with `originWhitelist={['about:blank']}` is redundant
     (about:blank JS is sandboxed). Low risk but follow principle of least privilege
   - Fix: Set `javaScriptEnabled={false}` — the receipt HTML has no JS

8. **`handleDownload` in web ReceiptModal downloads HTML not PDF** (SUGGESTION, line 162-168)
   - File is saved as `receipt-*.html` — misleading for users who expect a PDF
   - The iframe print approach is better UX; download should use `window.print()` with print-to-PDF guidance

### Web receipts page — type-safety note
- `order: Record<string, unknown>` mapping with many `as string` casts (lines 75-148) — accepted pattern
  for external API data, but Zod validation at the API boundary would eliminate the need for these casts

## web ogabassey ChatWidget Modularization (2026-02-17)

### Files reviewed
- `apps/web/src/components/storefront/ogabassey/components/chat/` (6 files)
- `apps/web/src/components/storefront/ogabassey/components/ChatWidget.tsx` (re-export shim)
- `apps/web/src/components/storefront/santa-chat/types.ts`

### Known Bugs Found (CRITICAL/HIGH)

1. **React namespace used without import in use-ogabassey-chat.ts** (CRITICAL)
   - `React.RefObject` and `React.FormEvent` in the `UseOgabasseyChat` interface at lines 18-21
   - No `import type React from 'react'` or `import type { RefObject, FormEvent }` exists
   - TypeScript strict mode will fail to compile; the build is broken
   - Fix: Add `import type { RefObject, FormEvent } from 'react'` and update the interface

2. **Stream protocol mismatch for Santa route** (CRITICAL)
   - `/api/chat/santa` returns `result.toTextStreamResponse()` — AI SDK SSE wire format
   - `use-ogabassey-chat.ts` reads with raw `TextDecoder` expecting plain UTF-8 text
   - Result: Santa responses show SSE garbage like `0:"Ho"` instead of real text
   - `/api/chat` (non-santa) uses `generateText` + plain `text/plain` — works correctly
   - Fix: Change santa route to `generateText` + plain Response, OR use AI SDK `useChat` hook

3. **TextDecoder buffer never flushed after stream ends** (HIGH)
   - `decoder.decode(value, { stream: true })` accumulates a multi-byte boundary buffer
   - After the while loop exits, `decoder.decode()` (no args) is never called to flush
   - Truncated multi-byte UTF-8 characters (e.g., ₦ symbol, emoji) at chunk boundaries
   - Fix: After the while loop, append `decoder.decode()` to flush

4. **ReadableStream reader not cancelled on error** (HIGH)
   - If `fetch` throws or `response.ok` fails mid-stream, `reader.cancel()` is never called
   - Causes the underlying TCP connection to stay open (stream leak)
   - Fix: Wrap reader logic in try/finally and call `reader.cancel()` in finally

5. **Stale `messages` closure in handleSend history** (HIGH)
   - `messages.map(...)` at line 86 captures the pre-setState snapshot
   - The `setMessages((prev) => [...prev, newMessage])` at line 74 updates state asynchronously
   - The history sent to the API correctly excludes the new user message (OK for the API call)
   - BUT: if two sends overlap, the second call's `messages` snapshot won't include the first reply
   - Fix: Use a `messagesRef` synced to state so `handleSend` always reads the latest messages

6. **No in-flight guard — concurrent sends corrupting message list** (HIGH)
   - `isLoading` is set true but `handleSubmit` does not check it before calling `handleSend`
   - `handleSend` itself only checks `messageText.trim()`, not `isLoading`
   - A fast double-tap or suggestion click while loading fires two concurrent requests
   - Fix: Add `if (isLoading) return;` at the top of `handleSend`

### Known Bugs Found (MEDIUM/LOW)

7. **Missing `type="button"` on proactive dismiss button** (MEDIUM)
   - `ChatWidget.tsx` line 191: `<button onClick={...}>` with no `type` attribute
   - Inside a `<div>` not a `<form>`, so default is "submit" — safe here but violates project pattern
   - Fix: Add `type="button"`

8. **Raw `<img>` tags violate next/image rule** (MEDIUM)
   - `ChatWidget.tsx` lines 76-79 and 219-222: Santa avatar uses `<img src="...">` not `next/image`
   - `markdown-renderer.tsx` line 64: AI-generated image URLs rendered with raw `<img>`
   - For markdown images: using `next/image` requires known dimensions; raw `<img>` is acceptable
   - For Santa avatar (known local asset): should use `next/image`
   - Fix: Replace Santa avatar `<img>` with `<Image>` from `next/image` with explicit width/height

9. **`parseSantaAction` regex doesn't handle decimal prices** (LOW)
   - Pattern: `/ACTION:ADD_TO_CART\|PRODUCT:([^|]+)\|PRICE:(\d+(?:,\d+)*)/`
   - Matches `120,000` but not `120000.50` — though Naira prices are typically integers, this is fragile
   - Fix: `/PRICE:(\d[\d,.]*)/` and parse with `Number(m[2].replace(/,/g, ''))`

### Architecture Notes
- `/api/chat` uses `generateText` (non-streaming) → plain `text/plain` response → works with TextDecoder
- `/api/chat/santa` uses `streamText` → AI SDK SSE stream → BROKEN with current TextDecoder reader
- `OGABASSEY_MERCHANT_ID` in `api/chat/santa/route.ts` is now `'3bc72679-c0f7-4db4-9054-6a4a4a95a498'` (fixed from previous 2-UUID bug)
- Re-export chain: `components/ChatWidget.tsx` → `chat/index.ts` → `chat/ChatWidget.tsx` (correct, no circularity)
