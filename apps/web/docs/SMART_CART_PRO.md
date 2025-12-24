# Smart Cart Pro - Premium Cart Features

> **Status:** Planned  
> **Priority:** High  
> **Estimated Revenue Impact:** Medium-High

## Overview

Smart Cart Pro is a premium add-on that provides advanced cart functionality beyond basic e-commerce operations. These features are designed to increase conversion rates and average order value for merchants.

---

## Feature Tiers

### 🆓 Basic Cart (Free - All Plans)

| Feature | Description |
|---------|-------------|
| Add/Remove Items | Standard cart operations |
| Quantity Updates | Adjust item quantities |
| Persistent Cart | localStorage-based persistence |
| Cart Summary | Subtotal, item count |
| Basic Checkout | Standard checkout flow |

### ⭐ Smart Cart Pro (Paid Add-on or Pro Plan)

| Feature | Description | Value Proposition |
|---------|-------------|-------------------|
| **Price Negotiation** | Let customers make offers on items | Increases conversion for high-value items |
| **Device Assurance** | Add warranty/protection at checkout | New revenue stream (5-10% of item value) |
| **Smart Upsells** | AI-suggested complementary products | Increases AOV by 15-30% |
| **Cart-wide Discounts** | Apply percentage discounts to entire cart | Enables bundle pricing |
| **Cart Abandonment** | Email recovery for abandoned carts | Recovers 10-15% of abandoned carts |
| **Cart Analytics** | Detailed cart behavior insights | Data-driven optimization |

---

## Business Model Options

### Option A: Add-on Pricing
- **$9.99/month** for Smart Cart Pro
- Available on any plan
- Simple a-la-carte upgrade

### Option B: Plan-based Bundling
- **Free Plan:** Basic Cart only
- **Pro Plan ($29/month):** Includes Smart Cart Pro
- **Business Plan ($79/month):** Smart Cart Pro + Priority Support

### Option C: Per-Feature Pricing
- Price Negotiation: $4.99/month
- Device Assurance: $4.99/month
- Smart Upsells: $4.99/month
- Bundle all three: $9.99/month

**Recommended:** Option B (Plan-based bundling) - simpler for merchants to understand

---

## Technical Implementation

### Phase 1: Feature Flags (Required First)

```typescript
// src/lib/feature-flags.ts
interface MerchantFeatures {
  smartCartPro: boolean;
  priceNegotiation: boolean;
  deviceAssurance: boolean;
  smartUpsells: boolean;
  cartAbandonment: boolean;
}

// Check in components:
const { hasFeature } = useMerchantFeatures();
if (hasFeature('priceNegotiation')) {
  // Show negotiation UI
}
```

### Phase 2: Database Schema

```sql
-- Add to merchants table
ALTER TABLE merchants ADD COLUMN plan_tier TEXT DEFAULT 'free';
ALTER TABLE merchants ADD COLUMN features JSONB DEFAULT '{}';

-- Or create separate feature_flags table
CREATE TABLE merchant_features (
  merchant_id UUID REFERENCES merchants(id),
  feature_key TEXT NOT NULL,
  enabled BOOLEAN DEFAULT false,
  enabled_at TIMESTAMPTZ,
  PRIMARY KEY (merchant_id, feature_key)
);
```

### Phase 3: Unified Cart with Feature Gating

```typescript
// src/hooks/use-cart.tsx (enhanced)
export function useCart() {
  const { hasFeature } = useMerchantFeatures();
  
  // Basic features (always available)
  const addToCart = (...) => { ... };
  const removeFromCart = (...) => { ... };
  
  // Premium features (gated)
  const applyNegotiatedPrice = hasFeature('priceNegotiation') 
    ? (...) => { ... } 
    : undefined;
  
  const toggleAssurance = hasFeature('deviceAssurance')
    ? (...) => { ... }
    : undefined;
}
```

---

## Migration Path

### Current State
- Two cart systems: `use-cart` (basic) and `v2-cart-context` (premium features)
- Ogabassey template uses v2-cart-context
- Other templates use use-cart

### Target State
- One unified cart: `use-cart` with all features
- Feature flags control which features are available
- Templates request features, cart provides based on merchant plan

### Migration Steps

1. **Create feature flag system** (`src/lib/feature-flags.ts`)
2. **Add plan_tier to merchants table** in Supabase
3. **Merge v2-cart-context into use-cart** with conditional features
4. **Update all templates** to use unified cart
5. **Delete v2-cart-context** 
6. **Add upgrade prompts** in dashboard for free users

---

## UI/UX Considerations

### For Free Users
- Show "Upgrade to Pro" badges next to locked features
- Allow preview of premium features (read-only)
- Clear value proposition on upgrade modal

### For Pro Users
- Seamless access to all features
- "Pro" badge in cart UI
- Access to cart analytics dashboard

---

## Competitor Analysis

| Platform | Price Negotiation | Device Assurance | Smart Upsells |
|----------|-------------------|------------------|---------------|
| **Shopify** | Via app ($29/mo) | Via app ($19/mo) | Built-in (Plus) |
| **BigCommerce** | Custom dev | Not available | Built-in |
| **WooCommerce** | Plugin ($49) | Not available | Plugin ($79) |
| **Baci (Proposed)** | $9.99/mo bundled | $9.99/mo bundled | $9.99/mo bundled |

**Competitive Advantage:** Baci offers all three features at a lower price than competitors charge for one.

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Pro adoption rate | 20% of active merchants | % of paid plans |
| AOV increase with upsells | +15% | Compare Pro vs Free merchants |
| Cart recovery rate | 10% | Abandoned cart emails → conversions |
| Negotiation acceptance rate | 30% | Offers made → accepted |

---

## Next Steps

1. [ ] Create `src/lib/feature-flags.ts` with basic structure
2. [ ] Add `plan_tier` column to merchants table
3. [ ] Create upgrade modal component
4. [ ] Merge cart systems (Phase 3)
5. [ ] Build cart analytics dashboard
6. [ ] Set up Stripe for add-on billing

---

## Related Files

- `src/hooks/use-cart.tsx` - Basic cart (to be enhanced)
- `src/components/storefront/ogabassey-v2/providers/v2-cart-context.tsx` - Premium cart (to be merged)
- `src/lib/feature-flags.ts` - Feature flag system (to be created)
