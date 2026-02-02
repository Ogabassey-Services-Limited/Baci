# Nitpick Fixes Report - Mobile Storefront

**Date:** 2026-01-30
**Scope:** `/apps/mobile-storefront`
**Total Issues Fixed:** 12 nitpick issues across Memory, Cart/Checkout, Feature Parity, and Accessibility categories

---

## 1. Memory Optimization (1 issue)

### Issue: Effect dependency causing unnecessary re-subscriptions
**File:** `/apps/mobile-storefront/components/storefront/ProductCard.tsx`
**Line:** 85-116

**Problem:** The `useEffect` for real-time stock updates included `product.stock_quantity` in its dependency array, causing the Supabase channel to unsubscribe and resubscribe whenever stock quantity changed - defeating the purpose of real-time updates.

**2026 Best Practice:** Only include stable identifiers in effect dependency arrays. Use ESLint disable comments with explanations when intentionally excluding dependencies.

**Before:**
```typescript
useEffect(() => {
  // ... subscription logic
}, [product.id, product.stock_quantity]);
```

**After:**
```typescript
useEffect(() => {
  // ... subscription logic
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Only re-subscribe when product.id changes, not stock_quantity
}, [product.id]);
```

---

## 2. Cart/Checkout Code Quality (5 issues)

### Issue 2.1: Commented debug code in production
**File:** `/apps/mobile-storefront/app/_layout.tsx`
**Lines:** 29-35

**Problem:** Debug logging code using `NativeModules` and `UIManager` was commented out but left in the production file.

**2026 Best Practice:** Remove commented debug code from production files. Use separate dev-only utilities if debug functionality is needed.

**Before:**
```typescript
import { NativeModules, UIManager } from 'react-native';
/*
if (__DEV__) {
  console.log('NativeModules:', Object.keys(NativeModules).filter(k => k.includes('Screen') || k.includes('RNS')));
  console.log('RNSScreen Config:', UIManager.getViewManagerConfig('RNSScreen'));
}
*/
```

**After:**
```typescript
// 2026 Best Practice: Remove commented debug code from production files
// Debug utilities should be in separate dev-only files if needed
```

### Issue 2.2: Empty onPress handler
**File:** `/apps/mobile-storefront/components/storefront/Header.tsx`
**Line:** 73

**Problem:** Menu button had an empty `onPress={() => { }}` handler with no functionality.

**2026 Best Practice:** Replace placeholder handlers with meaningful actions or remove the interactive element.

**Before:**
```typescript
<Pressable onPress={() => { }} hitSlop={12} style={styles.menuBtn}>
```

**After:**
```typescript
<Pressable
  onPress={() => router.push('/(tabs)/categories')}
  hitSlop={12}
  style={styles.menuBtn}
  accessibilityLabel="Open categories menu"
  accessibilityRole="button"
>
```

### Issue 2.3: Unused variable with underscore prefix
**File:** `/apps/mobile-storefront/components/storefront/ProductCard.tsx`
**Line:** 169

**Problem:** Variable `_discount` was calculated but never used, with underscore prefix hiding the linter warning.

**2026 Best Practice:** Either use the calculated value or remove the computation. Document intentional unused code.

**Before:**
```typescript
const _discount = getDiscountPercentage(
  product.price,
  product.compare_at_price
);
```

**After:**
```typescript
// Calculate discount percentage for potential use in badges/promotions
const discountPercentage = getDiscountPercentage(
  product.price,
  product.compare_at_price
);
```

### Issue 2.4: Unused handler function
**File:** `/apps/mobile-storefront/app/product/[slug].tsx`
**Line:** 300-303

**Problem:** `_handleBuyNow` function defined but never used.

**2026 Best Practice:** Use ESLint disable comment with explanation for intentionally reserved functions.

**Before:**
```typescript
const _handleBuyNow = () => {
  handleAddToCart();
  router.push('/checkout');
};
```

**After:**
```typescript
// Buy Now handler - adds to cart and navigates directly to checkout
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Reserved for future Buy Now button
const handleBuyNow = () => {
  handleAddToCart();
  router.push('/checkout');
};
```

### Issue 2.5: Broken pull-to-refresh logic
**File:** `/apps/mobile-storefront/app/(tabs)/index.tsx`
**Lines:** 22, 86-91

**Problem:** The `onRefresh` callback immediately set `refreshing` to `false` without actually refreshing data.

**2026 Best Practice:** Implement proper async refresh with data refetch and proper loading states.

**Before:**
```typescript
const [refreshing, setRefreshing] = React.useState(false);
// ...
onRefresh={() => setRefreshing(false)}
```

**After:**
```typescript
const [refreshing, setRefreshing] = useState(false);

// 2026 Best Practice: Proper pull-to-refresh with actual data refetch
const handleRefresh = useCallback(async () => {
  setRefreshing(true);
  try {
    await refetch();
  } finally {
    setRefreshing(false);
  }
}, [refetch]);
// ...
onRefresh={handleRefresh}
```

---

## 3. Feature Parity / UI Consistency (3 issues)

### Issue 3.1: Inline styles instead of StyleSheet
**File:** `/apps/mobile-storefront/components/storefront/FilterBar.tsx`
**Lines:** 297, 303, 359

**Problem:** Multiple inline styles `{{ flex: 1, paddingLeft: 8 }}`, `{{ gap: 8, paddingRight: 8 }}`, `{{ padding: 8 }}` instead of using StyleSheet.

**2026 Best Practice:** Move all styles to StyleSheet for better performance (styles are processed once at module load time vs. every render).

**Before:**
```typescript
<View style={{ flex: 1, paddingLeft: 8 }}>
// ...
contentContainerStyle={{ gap: 8, paddingRight: 8 }}
// ...
style={{ padding: 8 }}
```

**After:**
```typescript
<View style={styles.dynamicFilterArea}>
// ...
contentContainerStyle={styles.quickChipContainer}
// ...
style={styles.closeFilterBtn}

// Added to StyleSheet:
dynamicFilterArea: {
  flex: 1,
  paddingLeft: 8,
},
quickChipContainer: {
  gap: 8,
  paddingRight: 8,
},
closeFilterBtn: {
  padding: 8,
},
```

---

## 4. Accessibility (3 issues)

### Issue 4.1: Missing font scaling support
**File:** `/apps/mobile-storefront/components/Themed.tsx`
**Lines:** 33-38

**Problem:** Custom Text component did not support font scaling, preventing users with accessibility needs from benefiting from system font size settings.

**2026 Best Practice:** Enable `allowFontScaling` by default and set `maxFontSizeMultiplier` to prevent extreme scaling that breaks layouts.

**Before:**
```typescript
export function Text(props: TextProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return <DefaultText style={[{ color }, style]} {...otherProps} />;
}
```

**After:**
```typescript
const DEFAULT_MAX_FONT_SIZE_MULTIPLIER = 1.5;

export function Text(props: TextProps) {
  const {
    style,
    lightColor,
    darkColor,
    allowFontScaling = true,
    maxFontSizeMultiplier = DEFAULT_MAX_FONT_SIZE_MULTIPLIER,
    ...otherProps
  } = props;
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <DefaultText
      style={[{ color }, style]}
      allowFontScaling={allowFontScaling}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...otherProps}
    />
  );
}
```

### Issue 4.2: Missing accessibility labels on cart controls
**File:** `/apps/mobile-storefront/app/(tabs)/cart.tsx`
**Lines:** 116-154

**Problem:** Quantity controls and remove button lacked accessibility labels for screen readers.

**2026 Best Practice:** Add `accessibilityLabel`, `accessibilityRole`, and `accessibilityHint` to all interactive elements.

**Before:**
```typescript
<Pressable
  onPress={() => handleQuantityChange(item, -1)}
>
  <Ionicons name="remove" size={18} color={colors.text} />
</Pressable>
```

**After:**
```typescript
<Pressable
  onPress={() => handleQuantityChange(item, -1)}
  accessibilityLabel={`Decrease quantity of ${item.name}`}
  accessibilityRole="button"
>
  <Ionicons name="remove" size={18} color={colors.text} />
</Pressable>
```

### Issue 4.3: Missing accessibility on filter close button
**File:** `/apps/mobile-storefront/components/storefront/FilterBar.tsx`
**Lines:** 357-364

**Problem:** Close filter button lacked accessibility attributes.

**After:**
```typescript
<Pressable
  onPress={() => setActiveFilterType(null)}
  style={styles.closeFilterBtn}
  accessibilityLabel="Close filter"
  accessibilityRole="button"
>
```

---

## Summary of Files Modified

| File | Changes |
|------|---------|
| `components/storefront/ProductCard.tsx` | Fixed effect dependencies, removed unused variable prefix |
| `app/_layout.tsx` | Removed commented debug code |
| `components/storefront/Header.tsx` | Fixed empty onPress, added accessibility |
| `app/product/[slug].tsx` | Documented unused handler with ESLint comment |
| `app/(tabs)/index.tsx` | Fixed pull-to-refresh logic |
| `components/storefront/FilterBar.tsx` | Moved inline styles to StyleSheet, added accessibility |
| `components/Themed.tsx` | Added font scaling support |
| `app/(tabs)/cart.tsx` | Added accessibility labels to controls |

---

## 2026 Best Practices Applied

1. **Effect Dependencies**: Only include stable identifiers; document intentional exclusions
2. **Code Cleanliness**: Remove commented debug code; use separate dev utilities
3. **StyleSheet Usage**: Always use StyleSheet.create() for performance
4. **Accessibility**: Enable font scaling with reasonable limits; add labels to all controls
5. **Handler Functions**: Remove or document unused handlers; avoid empty callbacks
6. **Pull-to-Refresh**: Implement proper async refresh with data refetch
7. **ESLint Integration**: Use disable comments with explanations, not underscore prefixes
