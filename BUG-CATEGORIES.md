# Bug Categories - Baci E-Commerce Platform

## Overview

This document catalogs all bug categories identified across the Baci codebase audits, combining findings from both `BUGLIST.md` (45 issues) and `BUG-HUNTING-REPORT.md` (154 issues).

---

## Category Taxonomy

### 1. Cart & Checkout
Issues related to shopping cart functionality, checkout flow, order creation, and payment processing.

**Sub-categories:**
- Cart state management
- Checkout flow steps
- Order creation/persistence
- Cart synchronization (guest vs authenticated)
- Cart validation timing
- Double-submit prevention
- Cart clearing logic

**Severity Distribution:** Critical, High, Medium

---

### 2. Payment & Transactions
Issues related to payment gateway integrations, webhook handling, refunds, and transaction records.

**Sub-categories:**
- Paystack integration
- Korapay integration
- Credit Direct / CredPal (BNPL)
- Webhook idempotency
- Refund processing
- Transaction status tracking
- Gateway fee calculations
- Wallet operations

**Severity Distribution:** Critical, High, Medium

---

### 3. Inventory & Stock
Issues related to product stock tracking, real-time updates, and stock validation.

**Sub-categories:**
- Stock quantity tracking
- Variant stock tracking
- Real-time stock updates (Supabase Realtime)
- Pre-checkout stock validation
- Out-of-stock handling
- Scarcity badges
- Offline stock fallbacks

**Severity Distribution:** Critical, High, Medium

---

### 4. Pricing & Discounts
Issues related to price calculations, discount codes, and display formatting.

**Sub-categories:**
- Discount code validation
- Percentage discount calculations
- Floating-point precision
- Negotiated price handling
- Compare-at-price display
- Cart assurance calculations
- Currency formatting consistency

**Severity Distribution:** Critical, Medium, Nitpick

---

### 5. Form Validation & Security
Issues related to input validation, XSS prevention, and data sanitization.

**Sub-categories:**
- Zod schema validation
- HTML/XSS sanitization
- Email validation
- Phone number validation
- Address validation
- IMEI validation (Luhn checksum)
- UUID validation
- Ownership verification

**Severity Distribution:** Critical, High, Medium

---

### 6. Auth & Session
Issues related to user authentication, session management, and authorization.

**Sub-categories:**
- Login/logout flows
- Session token storage
- Auth state persistence
- Route protection/gating
- Guest vs authenticated state
- Cart isolation per user
- OAuth integration (Google)
- OTP verification

**Severity Distribution:** Critical, High, Medium

---

### 7. Memory Leaks
Issues related to uncleared timers, subscriptions, and state updates on unmounted components.

**Sub-categories:**
- setTimeout/setInterval cleanup
- Supabase subscription cleanup
- Animation value cleanup
- Event listener cleanup
- Ref-based timer tracking

**Severity Distribution:** Critical, Major, Minor

---

### 8. Offline & Network
Issues related to network state handling, offline mode, and data synchronization.

**Sub-categories:**
- Network state monitoring
- Offline fallbacks
- Pull-to-refresh functionality
- Request timeout handling
- Offline mutation queue
- Image caching for offline
- Connectivity banners
- Retry mechanisms

**Severity Distribution:** Critical, Major, Minor

---

### 9. Performance
Issues related to rendering performance, memoization, and optimization.

**Sub-categories:**
- Component memoization (React.memo)
- FlatList/FlashList optimization
- Inline function creation
- Animation performance
- Image loading optimization
- Bundle size
- Code splitting

**Severity Distribution:** Critical, Major, Minor

---

### 10. Accessibility (WCAG)
Issues related to screen reader support, touch targets, and inclusive design.

**Sub-categories:**
- accessibilityLabel missing
- accessibilityRole missing
- Touch target sizing (44x44 min)
- Focus management
- Dynamic content announcements
- Color contrast
- Font scaling support
- VoiceOver/TalkBack compatibility

**WCAG Levels:** A, AA, AAA

**Severity Distribution:** Critical (47 labels), Major (38 items), Minor (6 items), Nitpick (35+ items)

---

### 11. Toast & User Feedback
Issues related to user notifications, error messages, and action confirmations.

**Sub-categories:**
- Success confirmations
- Error feedback
- Loading states
- Silent failure prevention
- Toast styling consistency
- Action result communication

**Severity Distribution:** Critical, Major, Medium

---

### 12. Navigation
Issues related to routing, deep linking, and navigation flows.

**Sub-categories:**
- Route type safety
- Deep linking support
- Back button handling (Android)
- Tab state preservation
- Navigation transitions
- Route parameter validation
- 404 handling

**Severity Distribution:** Critical, Major, Minor

---

### 13. TypeScript Safety
Issues related to type safety, null checks, and type assertions.

**Sub-categories:**
- Route casting (`as any`)
- Untyped API responses
- Untyped database results
- Missing null checks
- Unsafe property access
- Generic type parameters

**Severity Distribution:** Critical, Major, Minor

---

### 14. Feature Parity
Issues where mobile app lacks features available on web.

**Sub-categories:**
- Wishlist/saved items
- Product negotiation
- Swap/trade-in
- IMEI checker
- Blog/content system
- Customer reviews
- Order tracking details

**Severity Distribution:** Critical, Major, Minor

---

### 15. Keyboard & Input
Issues related to keyboard handling and form input UX.

**Sub-categories:**
- returnKeyType props
- textContentType (iOS autofill)
- autoComplete (Android autofill)
- Keyboard dismiss handling
- Input field focus flow
- Keyboard-aware scrolling

**Severity Distribution:** Major, Minor

---

### 16. Data Persistence
Issues related to local storage, caching, and data survival across sessions.

**Sub-categories:**
- Theme persistence
- Search history persistence
- Cart persistence
- Auth token storage
- Secure storage usage
- Cache invalidation

**Severity Distribution:** Critical, Major, Minor

---

## Category by Codebase Area

| Category | Web | Mobile | Shared |
|----------|-----|--------|--------|
| Cart & Checkout | Yes | Yes | Logic |
| Payment & Transactions | Yes | - | API |
| Inventory & Stock | Yes | Yes | API |
| Pricing & Discounts | Yes | Yes | Logic |
| Form Validation | Yes | Yes | Schemas |
| Auth & Session | Yes | Yes | Supabase |
| Memory Leaks | - | Yes | - |
| Offline & Network | - | Yes | - |
| Performance | Yes | Yes | - |
| Accessibility | Yes | Yes | - |
| Toast & Feedback | Yes | Yes | - |
| Navigation | Yes | Yes | - |
| TypeScript Safety | Yes | Yes | Types |
| Feature Parity | - | Yes | - |
| Keyboard & Input | - | Yes | - |
| Data Persistence | Yes | Yes | Storage |

---

## Issue Count by Category

| Category | BUGLIST.md | BUG-HUNTING-REPORT.md | Total |
|----------|------------|----------------------|-------|
| Cart & Checkout | 5 | 24 | 29 |
| Payment & Transactions | 5 | - | 5 |
| Inventory & Stock | 5 | - | 5 |
| Pricing & Discounts | 4 | - | 4 |
| Form Validation | 5 | - | 5 |
| Auth & Session | 4 | 3 | 7 |
| Memory Leaks | - | 6 | 6 |
| Offline & Network | - | 15 | 15 |
| Performance | - | 10 | 10 |
| Accessibility | - | 92+ | 92+ |
| Toast & Feedback | - | 18 | 18 |
| Navigation | - | 15 | 15 |
| TypeScript Safety | - | 31 | 31 |
| Feature Parity | - | 15 | 15 |
| Keyboard & Input | - | 17 | 17 |
| Data Persistence | - | 8 | 8 |
| **Total** | **45** | **154** | **199** |

---

## Priority Matrix

### P0 - Ship Blockers
- Payment not processed
- Orders not persisted
- Security vulnerabilities (XSS, token exposure)
- Data loss scenarios

### P1 - Must Fix Before Launch
- Cart race conditions
- Stock validation gaps
- Auth flow issues
- Critical accessibility (screen reader labels)

### P2 - Fix Before Beta
- Performance issues
- Memory leaks
- Toast/feedback gaps
- TypeScript safety

### P3 - Fix Before GA
- Feature parity
- Polish items
- Minor accessibility
- Keyboard UX

### P4 - Tech Debt
- Code quality
- Unused variables
- Console.log removal
- Currency format standardization

---

*Generated: January 31, 2026*
*Sources: BUGLIST.md, BUG-HUNTING-REPORT.md*
