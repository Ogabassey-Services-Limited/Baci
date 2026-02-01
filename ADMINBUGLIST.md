# Mobile Admin Bug List - Baci E-Commerce Platform

**Generated:** February 1, 2026
**Codebase:** `/apps/mobile-admin`
**Total Issues:** 139+ bugs across 10 categories

---

## Executive Summary

This comprehensive bug audit was conducted by deploying 10 specialized bug hunting agents across the mobile-admin React Native app. The audit identified **139+ bugs** ranging from critical security vulnerabilities to minor polish items.

### Severity Distribution

| Severity | Count | Percentage |
|----------|-------|------------|
| Critical | 19 | 14% |
| Major | 85 | 61% |
| Minor | 35 | 25% |

### Category Distribution

| Category | Issues | Priority |
|----------|--------|----------|
| TypeScript Safety | 31 | High |
| Accessibility (WCAG) | 30 | High |
| Form Validation | 20 | Critical |
| Offline & Network | 14 | Critical |
| User Feedback | 12 | High |
| Performance | 10+ | Medium |
| Auth & Session | 9 | Critical |
| Navigation | 9 | High |
| Data Persistence | 8 | Critical |
| Memory Leaks | 6 | High |

---

## CRITICAL Issues (P0 - Ship Blockers)

### 1. Auth & Session Security

#### 1.1 RevenueCat Listener Never Unsubscribed
- **File:** `stores/revenueCatStore.ts:95-101`
- **Issue:** `addCustomerInfoUpdateListener` registered but never removed
- **Impact:** Memory leak, data mixing between users on logout/login
- **Fix:** Store listener subscription, implement cleanup method

#### 1.2 Query Cache Not Cleared on Logout
- **File:** `hooks/useAuth.ts:61-63`
- **Issue:** `signOut()` only clears auth, not TanStack Query cache
- **Impact:** Previous user's cached data (orders, products, customers) visible to next user
- **Fix:** Call `clearAdminQueryCache()` from `lib/query-client.ts` during logout

#### 1.3 OAuth Redirect URL Not Validated
- **File:** `app/(auth)/login.tsx:86-92`
- **Issue:** Google Sign-In accepts tokens without origin validation
- **Impact:** Open redirect vulnerability, potential token injection
- **Fix:** Implement PKCE flow, validate redirect URLs

---

### 2. Form Validation & Security

#### 2.1 Missing Email Validation
- **Files:** `app/(auth)/login.tsx:186-195`, `app/(auth)/register.tsx:124-137`
- **Issue:** Email validation uses `.trim()` only, no format validation
- **Impact:** Invalid email formats accepted (e.g., "user@", "user domain@test.com")
- **Fix:** Implement Zod email schema with `.email()` validator

#### 2.2 XSS Vulnerability in Customer Names/Product Descriptions
- **Files:** `app/(admin)/order/new.tsx:225-231`, `app/(admin)/product/[id].tsx:737-755`
- **Issue:** No HTML/XSS sanitization for text inputs
- **Impact:** Stored XSS vulnerability
- **Fix:** Apply HTML sanitization from `lib/sanitize.ts`

#### 2.3 Duplicate Order Submission Possible
- **File:** `app/(admin)/order/new.tsx:429`
- **Issue:** `isSubmitting` flag has race condition on rapid clicks
- **Impact:** Duplicate orders created, financial discrepancies
- **Fix:** Disable submit button, use request deduplication key

---

### 3. Offline & Network

#### 3.1 No Network State Monitoring
- **File:** `app/_layout.tsx`
- **Issue:** No `NetInfo`, `AppState`, or connectivity listener
- **Impact:** Users unaware when offline, failed mutations without warning
- **Fix:** Implement network state listener with connectivity banner

#### 3.2 API Client Has No Timeout
- **File:** `lib/api-client.ts:22-87`
- **Issue:** No timeout handling, no network error detection
- **Impact:** Requests hang indefinitely on slow networks
- **Fix:** Add `AbortController` with 15-30s timeout

#### 3.3 Mutations Don't Queue When Offline
- **Files:** `hooks/useOrders.ts`, `hooks/useProducts.ts`, `hooks/useCustomers.ts`
- **Issue:** No mutation queue/cache for offline operations
- **Impact:** Critical business operations lost on connection loss
- **Fix:** Implement offline mutation queue in Zustand with MMKV persistence

---

### 4. Data Persistence

#### 4.1 Push Token Not Cleaned on All Logout Paths
- **Files:** `app/(admin)/(tabs)/menu.tsx:46-56`, `app/(admin)/(tabs)/settings.tsx:220`
- **Issue:** Menu logout doesn't call `unregisterPush()`, settings logout has no handler
- **Impact:** Push tokens persist, notifications sent to logged-out users
- **Fix:** Extract logout into reusable function, implement all handlers

---

## MAJOR Issues (P1 - Must Fix Before Launch)

### 5. TypeScript Safety

#### 5.1 Unvalidated JSON.parse Operations
- **Files:** `app/(admin)/order/[id].tsx:362`, `app/(admin)/blog/edit-content.tsx:173`
- **Issue:** `JSON.parse` on localStorage/WebView data without schema validation
- **Impact:** App crashes on malformed data, XSS if storage compromised
- **Fix:** Add Zod schemas for all `JSON.parse` calls

#### 5.2 Double Assertion Pattern (as unknown as X)
- **Files:** `types/upload.ts:8`, `app/(admin)/store-settings.tsx:153`, `app/(admin)/product/[id].tsx:429`
- **Issue:** `file as unknown as Blob` bypasses type system
- **Impact:** Type safety holes across file upload operations
- **Fix:** Create proper TypeScript types for RN/Expo file objects

#### 5.3 Unsafe `as any` Navigation Casts
- **Files:** Multiple (16 instances across 8+ files)
- **Issue:** `router.push(\`/path/${id}\` as any)` defeats TypeScript
- **Impact:** Route mismatches undetected at build time
- **Fix:** Define proper route types for expo-router

#### 5.4 Unvalidated API Response Casting
- **Files:** `hooks/useProducts.ts:108,221,254`, `app/(admin)/domains/index.tsx:192`
- **Issue:** API responses cast without Zod validation
- **Impact:** Type system lies about data shape, runtime crashes
- **Fix:** Add Zod schemas for all API responses

---

### 6. Memory Leaks

#### 6.1 setTimeout Without Cleanup
- **Files:**
  - `components/domains/DomainOptionsSheet.tsx:41-43`
  - `app/(admin)/customize.tsx:135-141`
  - `app/(auth)/verify.tsx:217-223`
- **Issue:** `setTimeout` called without tracking or cleanup on unmount
- **Impact:** State updates on unmounted components, orphaned timers
- **Fix:** Track timeout IDs with refs, clear on unmount

#### 6.2 setInterval Race Condition in Verify Screen
- **File:** `app/(auth)/verify.tsx:31-44`
- **Issue:** Timer dependency on `timer` state creates potential for multiple active intervals
- **Impact:** Multiple intervals in rapid unmount scenarios
- **Fix:** Add mounted ref to prevent state updates after unmount

---

### 7. Accessibility (WCAG)

#### 7.1 Missing accessibilityLabel on Interactive Components
- **Files:** 22+ instances across menu, login, products, paywall screens
- **Issue:** Pressable/TouchableOpacity components lack `accessibilityLabel`
- **WCAG:** Fails 4.1.2 Name, Role, Value (Level A)
- **Impact:** Screen reader users cannot determine button purposes

**Critical Files:**
- `app/(admin)/(tabs)/menu.tsx:220-271` - Menu items
- `app/(auth)/login.tsx:302-407` - Login buttons (password toggle, social sign-in)
- `app/(admin)/(tabs)/products.tsx:243-296` - Product cards
- `components/paywall/Paywall.tsx:122-228` - Subscription buttons

#### 7.2 Touch Targets Below 44px Minimum
- **Files:** `components/dashboard/BranchSwitcher.tsx`, product card buttons
- **Issue:** Touch targets smaller than WCAG 2.5.5 minimum
- **Impact:** Users with motor impairments struggle to tap buttons

#### 7.3 Modal Missing accessibilityViewIsModal
- **File:** `components/ui/SuccessModal.tsx:21-26`
- **Issue:** Modal lacks `accessibilityViewIsModal={true}`
- **Impact:** Focus trap issues, screen readers announce background content

---

### 8. Navigation

#### 8.1 Route Parameters Not Validated
- **Files:** `app/(admin)/blog/[id].tsx:24`, `app/(admin)/product/[id].tsx:141`
- **Issue:** No Zod validation on route params before database queries
- **Impact:** App crashes with invalid IDs, potential injection

#### 8.2 Android Back Button Not Handled in Custom Modals
- **File:** `app/(admin)/order/[id].tsx:1467-1566`
- **Issue:** Custom modals (View overlay) don't handle hardware back button
- **Impact:** Back button closes entire screen instead of just modal (Android)

#### 8.3 Navigation State Lost on Modal Presentation
- **File:** `app/(auth)/verify.tsx:217-222`
- **Issue:** `router.dismissAll()` with 100ms `setTimeout` is timing-dependent
- **Impact:** Race condition causes non-deterministic navigation

---

### 9. User Feedback

#### 9.1 Missing Loading States on Critical Operations
- **Files:**
  - `app/(admin)/negotiations.tsx:76-89` - No loading during status update
  - `app/(admin)/discounts.tsx:36-55` - No loading during deletion
  - `app/(admin)/profile.tsx:65-87` - No loading during profile update
  - `app/(admin)/staff.tsx:64-111` - No loading during invitation
- **Impact:** Users can double-submit, no visual feedback

#### 9.2 Silent Failure on Product Status Switch
- **File:** `app/(admin)/product/[id].tsx:620-632`
- **Issue:** Switch updates UI immediately (optimistic) but doesn't rollback on API failure
- **Impact:** UI shows wrong status, user thinks change succeeded

#### 9.3 Generic Error Messages
- **Files:** Most mutation handlers
- **Issue:** Errors like "Failed to update" without specifics
- **Impact:** Users can't troubleshoot or understand what went wrong

---

### 10. Performance

#### 10.1 useNativeDriver: false in Animations
- **Files:** `app/(admin)/(tabs)/customers.tsx:58,66`, `products.tsx:111,119`, `orders.tsx:83,91`
- **Issue:** Search bar animations run on JS thread
- **Impact:** Frame drops during scrolling, janky animations

#### 10.2 Missing React.memo on FlatList Items
- **Files:** All tab screens with FlatList (customers, products, orders, inventory)
- **Issue:** `renderItem` callbacks not memoized
- **Impact:** O(n) re-renders for list items on any parent state change

#### 10.3 Missing getItemLayout on FlatLists
- **Files:** All FlatList usages
- **Issue:** No `getItemLayout` prop for consistent item heights
- **Impact:** Slower list initialization, janky scrolling

#### 10.4 Excessive console.log in Production
- **Files:** 56+ instances across codebase
- **Impact:** Performance overhead, memory accumulation

---

## MINOR Issues (P2 - Fix Before GA)

### 11. Additional TypeScript Issues
- `filter(Boolean)` pattern without type guard (3 instances)
- Untyped Date Range Filter Cast (`orders.tsx:839`)
- Untyped navigation parameters in several files

### 12. Additional Accessibility Issues
- Missing `allowFontScaling` on ErrorBoundary
- Z-Index stack collision (Toast and SnowEffect both use 9999)
- Decorative fallback icons missing `accessible={false}`

### 13. Form Validation Polish
- SKU input lacks format/uniqueness validation
- Business name slug auto-generation not validated
- Partial payment amount not validated against total

### 14. Data Persistence Polish
- Theme not user-preference persisted (system-only)
- Query cache size not limited (12-hour gc)
- Missing storage initialization error handling

---

## Fix Priority Order

### Phase 1: Critical Security & Stability (Immediate)
1. Query cache cleared on logout
2. Push token cleanup on all logout paths
3. Add Zod validation for JSON.parse calls
4. Email format validation
5. Network state monitoring + connectivity banner
6. API client timeout implementation

### Phase 2: Critical UX (This Sprint)
7. Offline mutation queue
8. Loading states on all mutations
9. Remove `as any` navigation casts
10. Android back button handling in modals
11. Double-submit prevention

### Phase 3: Accessibility (Next Sprint)
12. Add accessibilityLabel to all interactive components
13. Touch target sizing (44px minimum)
14. Modal accessibilityViewIsModal
15. Dynamic content announcements

### Phase 4: Performance (Before Beta)
16. Change useNativeDriver to true
17. Add React.memo to FlatList items
18. Add getItemLayout to FlatLists
19. Remove/wrap console.log statements

### Phase 5: Polish (Before GA)
20. Theme persistence
21. Skeleton loaders for refetches
22. Optimistic updates with proper rollback
23. Structured error messages

---

## Files Requiring Most Attention

| File | Issues | Categories |
|------|--------|------------|
| `app/(admin)/order/[id].tsx` | 8 | TypeScript, Memory, Navigation, User Feedback |
| `app/(admin)/product/[id].tsx` | 7 | TypeScript, Form Validation, User Feedback |
| `app/(auth)/login.tsx` | 6 | Auth, Form Validation, Accessibility |
| `app/(admin)/(tabs)/products.tsx` | 5 | TypeScript, Performance, Accessibility |
| `stores/revenueCatStore.ts` | 3 | Auth, Memory Leaks |
| `lib/api-client.ts` | 3 | Offline/Network, Error Handling |
| `hooks/useAuth.ts` | 2 | Auth, Data Persistence |

---

## Related Documentation

- [BUGLIST.md](./BUGLIST.md) - Web + Mobile Storefront bugs (45 issues, all fixed)
- [MOBILE-STOREFRONT-BUG-REPORT.md](./MOBILE-STOREFRONT-BUG-REPORT.md) - Mobile storefront bugs (92 issues)
- [BUG-CATEGORIES.md](./BUG-CATEGORIES.md) - Bug category taxonomy

---

*Last updated: February 1, 2026*
*Generated by: Claude Code Bug Hunter Agents*
