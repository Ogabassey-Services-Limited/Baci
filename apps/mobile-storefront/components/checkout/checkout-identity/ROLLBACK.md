# Rollback Instructions

## CheckoutIdentityModal Modularization

**Date:** 2026-02-03

This document provides instructions to rollback the modularization of `CheckoutIdentityModal` if needed.

---

## Quick Rollback (Git)

If you haven't committed the changes yet:

```bash
# Remove the new module folder
rm -rf apps/mobile-storefront/components/checkout/checkout-identity/
```

---

## Rollback Using Backup File

If you've already committed or the git history is not available:

```bash
# Navigate to the checkout directory
cd apps/mobile-storefront/components/checkout/

# Remove the module folder
rm -rf checkout-identity/
```

---

## What Was Changed

### Before (Monolithic)
```
components/checkout/
└── CheckoutIdentityModal.tsx  (635 lines)
```

### After (Modular)
```
components/checkout/
└── checkout-identity/
    ├── index.ts                       # Module exports
    ├── CheckoutIdentityModal.tsx      # Main component (~160 lines)
    ├── styles.ts                      # Shared styles
    ├── ROLLBACK.md                    # This file
    ├── components/
    │   ├── index.ts
    │   ├── CreateAccountCard.tsx
    │   ├── Divider.tsx
    │   ├── GuestCheckoutCard.tsx
    │   ├── SecurityFooter.tsx
    │   ├── SignInForm.tsx
    │   └── TabSelector.tsx
    └── hooks/
        ├── index.ts
        ├── useBottomSheetAnimation.ts
        └── useHapticFeedback.ts
```

---

## 2026 Best Practices Added

The modularization includes these improvements:

1. **Accessibility (WCAG 2.2 AA)**
   - `accessibilityRole` on all interactive elements
   - `accessibilityLabel` and `accessibilityHint`
   - `accessibilityState` for tabs
   - `accessibilityLiveRegion` for error announcements
   - Screen reader announcements via `AccessibilityInfo.announceForAccessibility`

2. **Reduced Motion Support**
   - Uses `useReducedMotion` from Reanimated
   - Instant animations when reduced motion is enabled

3. **User-Friendly Error Messages**
   - Maps Supabase errors to friendly messages
   - Email format validation
   - Field-specific validation

4. **Haptic Feedback**
   - `useHapticFeedback` hook with multiple styles
   - Success/warning/error haptics

5. **Code Organization**
   - Extracted reusable hooks
   - Modular components
   - Centralized styles
   - Clear separation of concerns

---

## Testing After Rollback

After rolling back, verify:

1. Modal opens and closes correctly
2. Tab switching works
3. Guest checkout navigates to `/checkout`
4. Sign-in form validates and submits
5. Register link navigates correctly
6. Animations play smoothly
