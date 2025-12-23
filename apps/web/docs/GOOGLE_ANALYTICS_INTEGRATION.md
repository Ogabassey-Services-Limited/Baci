# Google Analytics Integration Guide

## Overview

Baci uses a **dual analytics architecture**:
1. **Internal Analytics** → Supabase database (real-time, full control)
2. **Google Analytics 4** → For merchant marketing insights (optional per merchant)

---

## Why Dual Analytics?

### Internal Analytics (Supabase)
✅ Real-time (instant updates)
✅ Full data ownership
✅ Custom metrics
✅ No sampling
✅ Privacy-friendly
✅ Powers your dashboard

### Google Analytics 4
✅ Marketing attribution
✅ Audience targeting for ads
✅ Industry-standard reports
✅ Merchant familiarity
✅ Third-party integrations

---

## Implementation

### Step 1: Add GA4 to Merchant Storefronts

```typescript
// src/app/storefront/[slug]/layout.tsx
import Script from 'next/script';
import { getMerchantBySlug } from '@/lib/db';

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const merchant = await getMerchantBySlug(params.slug);
  const gaId = merchant?.google_analytics_id; // New column in merchants table

  return (
    <>
      {gaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}', {
                page_path: window.location.pathname,
              });
            `}
          </Script>
        </>
      )}
      {children}
    </>
  );
}
```

### Step 2: Add GA ID to Merchants Table

```sql
-- Migration: add_google_analytics_support
ALTER TABLE merchants ADD COLUMN google_analytics_id TEXT;
ALTER TABLE merchants ADD COLUMN google_analytics_enabled BOOLEAN DEFAULT false;

-- Merchants can add their GA4 measurement ID in settings
```

### Step 3: Track E-commerce Events (GA4 Enhanced E-commerce)

```typescript
// lib/analytics/ga4.ts
export function trackGA4Event(
  eventName: string,
  params: Record<string, any>
) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, params);
  }
}

// Track product views
export function trackProductView(product: Product) {
  trackGA4Event('view_item', {
    currency: 'USD',
    value: product.price,
    items: [{
      item_id: product.id,
      item_name: product.name,
      item_category: product.category,
      price: product.price,
    }],
  });
}

// Track add to cart
export function trackAddToCart(product: Product, quantity: number) {
  trackGA4Event('add_to_cart', {
    currency: 'USD',
    value: product.price * quantity,
    items: [{
      item_id: product.id,
      item_name: product.name,
      quantity: quantity,
      price: product.price,
    }],
  });
}

// Track purchases
export function trackPurchase(order: Order) {
  trackGA4Event('purchase', {
    transaction_id: order.id,
    value: order.total,
    currency: order.currency || 'USD',
    tax: order.tax || 0,
    shipping: order.shipping_cost || 0,
    items: order.items.map(item => ({
      item_id: item.product_id,
      item_name: item.product_name,
      quantity: item.quantity,
      price: item.price,
    })),
  });
}
```

### Step 4: Dual Tracking (Send to Both)

```typescript
// When user performs action
async function handleProductView(product: Product) {
  // 1. Track in Supabase (your dashboard)
  await fetch('/api/analytics/track', {
    method: 'POST',
    body: JSON.stringify({
      event: 'product_view',
      product_id: product.id,
      merchant_id: merchant.id,
    }),
  });

  // 2. Track in GA4 (if enabled)
  if (merchant.google_analytics_enabled) {
    trackProductView(product);
  }
}
```

---

## Merchant Dashboard Settings

Add to `/dashboard/settings`:

```tsx
<div className="space-y-4">
  <h3 className="text-lg font-semibold">Google Analytics Integration</h3>
  <p className="text-sm text-muted-foreground">
    Connect your Google Analytics 4 property to track visitor behavior and marketing campaigns.
  </p>

  <div className="flex items-center space-x-2">
    <Switch
      checked={googleAnalyticsEnabled}
      onCheckedChange={setGoogleAnalyticsEnabled}
    />
    <Label>Enable Google Analytics Tracking</Label>
  </div>

  <div className="space-y-2">
    <Label htmlFor="ga-id">GA4 Measurement ID</Label>
    <Input
      id="ga-id"
      placeholder="G-XXXXXXXXXX"
      value={googleAnalyticsId}
      onChange={(e) => setGoogleAnalyticsId(e.target.value)}
    />
    <p className="text-xs text-muted-foreground">
      Find your Measurement ID in Google Analytics → Admin → Data Streams
    </p>
  </div>

  <Alert>
    <Info className="h-4 w-4" />
    <AlertTitle>Privacy Note</AlertTitle>
    <AlertDescription>
      Google Analytics is optional. Your Baci dashboard already provides real-time analytics
      without any third-party tracking.
    </AlertDescription>
  </Alert>
</div>
```

---

## Data Flow Diagram

```
Customer Action (e.g., views product)
         |
         ├─────────────────────────────────┐
         ↓                                 ↓
    Supabase Event                    GA4 Event
  (analytics_events)              (if enabled by merchant)
         |                                 |
         ↓                                 ↓
  Your Analytics Dashboard         Google Analytics Reports
  (Real-time, full control)       (24-48hr delay, marketing)
```

---

## What Merchants See

### Your Dashboard (Built-in)
- Real-time sales data
- Product performance
- Customer insights
- Revenue analytics
- **Source:** Direct database queries
- **Latency:** 0ms (instant)

### Google Analytics (Optional)
- Traffic sources (where visitors come from)
- Marketing campaign performance
- Audience demographics
- Conversion funnels
- **Source:** GA4 API
- **Latency:** 24-48 hours

---

## Privacy Considerations

### GDPR Compliance
```typescript
// Only send to GA4 if user consents
function trackWithConsent(event: string, data: any) {
  const hasConsent = localStorage.getItem('analytics_consent') === 'true';

  if (hasConsent && merchant.google_analytics_enabled) {
    trackGA4Event(event, data);
  }

  // Always track in your own database (legitimate interest)
  trackInternalEvent(event, data);
}
```

### Cookie Banner (if using GA4)
```tsx
<CookieBanner>
  This site uses analytics to improve your experience.
  <Button onClick={() => acceptAnalytics()}>Accept</Button>
  <Button variant="outline" onClick={() => rejectAnalytics()}>Decline</Button>
</CookieBanner>
```

---

## Migration Path

### Phase 1: Current (✅ Done)
- Vercel Analytics for platform monitoring
- Internal analytics dashboard

### Phase 2: Add GA4 Support (Optional)
- Add `google_analytics_id` column to merchants
- Create settings page for merchants to add GA ID
- Implement dual tracking

### Phase 3: GA4 API Integration (Advanced)
- Pull GA4 data into your dashboard
- Show merchants GA4 insights alongside your analytics
- Best of both worlds

---

## Cost Analysis

### Your Analytics (Supabase)
- Storage: ~$0/month (included in plan)
- Queries: ~$0/month (unlimited)
- **Total: FREE**

### Google Analytics 4
- Standard: FREE up to 10M events/month
- Premium (GA360): $150K/year
- **Recommendation: Use FREE tier**

---

## Recommendation

**For Your Stage:**
1. ✅ Keep building your internal analytics dashboard
2. ❌ Don't add GA4 yet - not enough merchants to justify
3. 📝 Add GA4 support to roadmap for when merchants request it

**When to Add GA4:**
- When merchants ask for it (customer-driven)
- When you have 50+ merchants (market validation)
- When you need marketing attribution features

**Priority Order:**
1. Your analytics dashboard (DONE ✅)
2. Search improvements (when needed)
3. Vector embeddings (at scale)
4. GA4 integration (merchant request-driven)

---

## Sources for Best Practices

- [GA4 Enhanced E-commerce Events](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce)
- [Next.js Analytics Integration](https://nextjs.org/docs/app/building-your-application/optimizing/analytics)
- [GDPR-Compliant Analytics](https://gdpr.eu/cookies/)
