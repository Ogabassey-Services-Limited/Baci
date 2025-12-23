# Ogabassey UI Integration Plan

## Overview
Converting the Ogabassey-UI (Vite/React) storefront to Next.js App Router and integrating with Baci's Supabase backend.

**Source**: `/Users/mac/Baci-app/Ogabassey-UI/`
**Target**: `/Users/mac/Baci-app/Baci/src/components/storefront/ogabassey/`

---

## Phase 1: Core Layout Components

### 1.1 Navbar (Priority: HIGH)
- **Source**: `Ogabassey-UI/components/Navbar.tsx`
- **Target**: `src/components/storefront/ogabassey/navbar.tsx`
- **Features**:
  - Mobile menu with slide-out drawer
  - Search with AI-powered results (Gemini)
  - Notifications dropdown
  - Cart icon with count
  - Category dropdown navigation
  - Secondary nav bar (IMEI Checker, Repairs, Wallet links)
  - Scroll hide/show behavior

### 1.2 Footer
- **Source**: `Ogabassey-UI/components/Footer.tsx`, `MobileFooter.tsx`
- **Target**: `src/components/storefront/ogabassey/footer.tsx`
- **Features**:
  - Desktop footer with links
  - Mobile sticky footer navigation

### 1.3 Mobile Menu
- **Source**: `Ogabassey-UI/components/MobileMenu.tsx`
- **Target**: `src/components/storefront/ogabassey/mobile-menu.tsx`

---

## Phase 2: Product Display Components

### 2.1 Home Page
- **Source**: `Ogabassey-UI/components/Home.tsx`
- **Features**:
  - Hero carousel/banners
  - Featured products grid
  - Category highlights
  - Promotional sections

### 2.2 Product Card
- **Source**: `Ogabassey-UI/components/ProductCard.tsx`
- **Features**:
  - Grid/List view toggle
  - Add to cart animation
  - Wishlist toggle
  - Compare toggle
  - Condition badge (New/Used)
  - Rating display

### 2.3 Product Details
- **Source**: `Ogabassey-UI/components/ProductDetails.tsx`
- **Features**:
  - Image gallery
  - Variant selection (color, storage)
  - Price negotiation button
  - Add to cart
  - Product specs
  - Reviews section

### 2.4 Category Page
- **Source**: `Ogabassey-UI/components/CategoryPage.tsx`
- **Features**:
  - Advanced filters sidebar
  - Sort options
  - Grid/List toggle
  - Pagination

---

## Phase 3: Cart & Checkout

### 3.1 Cart Page
- **Source**: `Ogabassey-UI/components/CartPage.tsx`
- **Features**:
  - Line item management
  - Quantity controls
  - Price negotiation per item
  - Assurance toggle (5% protection)
  - Order summary
  - "Negotiate Total" feature

### 3.2 Negotiation Modal
- **Source**: `Ogabassey-UI/components/NegotiationModal.tsx`
- **Features**:
  - Price input
  - Processing animation
  - Accept/Reject states
  - 20% max discount rule

### 3.3 Cart Sidebar
- **Source**: `Ogabassey-UI/components/CartSidebar.tsx`
- **Features**:
  - Slide-out cart drawer
  - Quick item management

---

## Phase 4: Customer Account Pages

### 4.1 Profile Page
- **Source**: `Ogabassey-UI/components/ProfilePage.tsx`

### 4.2 Address Book
- **Source**: `Ogabassey-UI/components/AddressBookPage.tsx`

### 4.3 Orders & History
- **Source**: `Ogabassey-UI/components/OrdersPage.tsx`, `OrderDetailsPage.tsx`, `PurchaseHistoryPage.tsx`

### 4.4 Receipts
- **Source**: `Ogabassey-UI/components/ReceiptsPage.tsx`

### 4.5 Wallet
- **Source**: `Ogabassey-UI/components/WalletPage.tsx`
- **NEW BACKEND REQUIRED**: Customer wallet system

### 4.6 Reviews
- **Source**: `Ogabassey-UI/components/ReviewsPage.tsx`

### 4.7 Member Status (Loyalty)
- **Source**: `Ogabassey-UI/components/MemberStatusPage.tsx`

### 4.8 Notifications
- **Source**: `Ogabassey-UI/components/NotificationsPage.tsx`

### 4.9 Security
- **Source**: `Ogabassey-UI/components/SecurityPage.tsx`

---

## Phase 5: Special Service Pages (NEW FEATURES)

### 5.1 Device Repairs
- **Source**: `Ogabassey-UI/components/RepairsPage.tsx`
- **NEW BACKEND REQUIRED**:
  - `repair_services` table
  - `repair_bookings` table
  - API routes for booking repairs

### 5.2 Trade-in / Swap
- **Source**: `Ogabassey-UI/components/SwapPage.tsx`
- **NEW BACKEND REQUIRED**:
  - `trade_in_requests` table
  - `device_valuations` table
  - API routes for trade-in flow

### 5.3 IMEI Checker
- **Source**: `Ogabassey-UI/components/ImeiCheckerPage.tsx`
- **NEW BACKEND REQUIRED**:
  - External IMEI API integration
  - `imei_checks` table (log)

---

## Phase 6: Content Pages

### 6.1 About Us
- **Source**: `Ogabassey-UI/components/AboutUsPage.tsx`

### 6.2 Privacy Policy
- **Source**: `Ogabassey-UI/components/PrivacyPolicyPage.tsx`

### 6.3 Help & Support
- **Source**: `Ogabassey-UI/components/HelpSupportPage.tsx`

### 6.4 Blog
- **Source**: `Ogabassey-UI/components/BlogPage.tsx`

### 6.5 Legal Dispute
- **Source**: `Ogabassey-UI/components/LegalDisputePage.tsx`
- **NEW BACKEND REQUIRED**:
  - `disputes` table
  - Dispute workflow

### 6.6 Sustainability
- **Source**: `Ogabassey-UI/components/SustainabilityPage.tsx`

---

## Phase 7: Interactive Components

### 7.1 AI Chat Widget
- **Source**: `Ogabassey-UI/components/ChatWidget.tsx`
- **Integration**: Keep Gemini API

### 7.2 Product Comparison
- **Source**: `Ogabassey-UI/contexts/ComparisonContext.tsx`

### 7.3 Wishlist/Saved
- **Source**: `Ogabassey-UI/components/SavedPage.tsx`, `contexts/SavedContext.tsx`
- **Integration**: Wire to existing Baci wishlist

### 7.4 Toast Notifications
- **Source**: `Ogabassey-UI/components/UpsellToast.tsx`, `SavedToast.tsx`

### 7.5 Popup System
- **Source**: `Ogabassey-UI/components/PopupSystem.tsx`

### 7.6 Offline Notice
- **Source**: `Ogabassey-UI/components/OfflineNotice.tsx`

---

## New Database Tables Required

### 1. Customer Wallet System
```sql
-- customer_wallets
CREATE TABLE customer_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  merchant_id UUID REFERENCES merchants(id),
  balance DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- customer_wallet_transactions
CREATE TABLE customer_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID REFERENCES customer_wallets(id),
  type VARCHAR(20), -- 'fund', 'withdraw', 'purchase', 'refund'
  amount DECIMAL(12,2),
  balance_after DECIMAL(12,2),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. Repair Services
```sql
-- repair_services
CREATE TABLE repair_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES merchants(id),
  name VARCHAR(255),
  description TEXT,
  base_price DECIMAL(12,2),
  category VARCHAR(100), -- 'screen', 'battery', 'port', 'software'
  estimated_time VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- repair_bookings
CREATE TABLE repair_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES merchants(id),
  customer_email VARCHAR(255),
  customer_name VARCHAR(255),
  customer_phone VARCHAR(50),
  service_id UUID REFERENCES repair_services(id),
  device_type VARCHAR(100),
  device_model VARCHAR(255),
  issue_description TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'
  scheduled_date DATE,
  estimated_cost DECIMAL(12,2),
  final_cost DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. Trade-in System
```sql
-- trade_in_requests
CREATE TABLE trade_in_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES merchants(id),
  customer_email VARCHAR(255),
  customer_name VARCHAR(255),
  device_type VARCHAR(100),
  device_brand VARCHAR(100),
  device_model VARCHAR(255),
  storage_capacity VARCHAR(50),
  condition VARCHAR(50), -- 'excellent', 'good', 'fair', 'poor'
  estimated_value DECIMAL(12,2),
  final_offer DECIMAL(12,2),
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'evaluated', 'accepted', 'rejected', 'completed'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. IMEI Checks
```sql
-- imei_checks
CREATE TABLE imei_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES merchants(id),
  imei VARCHAR(20),
  result JSONB,
  checked_by VARCHAR(255), -- customer email or 'guest'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5. Disputes
```sql
-- disputes
CREATE TABLE disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES merchants(id),
  order_id UUID REFERENCES orders(id),
  customer_email VARCHAR(255),
  type VARCHAR(50), -- 'refund', 'product_issue', 'delivery', 'other'
  description TEXT,
  status VARCHAR(50) DEFAULT 'open', -- 'open', 'under_review', 'resolved', 'escalated', 'closed'
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## New API Routes Required

```
POST   /api/storefront/wallet/fund
POST   /api/storefront/wallet/withdraw
GET    /api/storefront/wallet/transactions

GET    /api/storefront/repairs/services
POST   /api/storefront/repairs/book
GET    /api/storefront/repairs/bookings

POST   /api/storefront/trade-in/estimate
POST   /api/storefront/trade-in/submit
GET    /api/storefront/trade-in/requests

POST   /api/storefront/imei/check

POST   /api/storefront/disputes/create
GET    /api/storefront/disputes
```

---

## File Structure (Target)

```
src/
├── components/
│   └── storefront/
│       └── ogabassey/
│           ├── layout/
│           │   ├── navbar.tsx
│           │   ├── footer.tsx
│           │   ├── mobile-footer.tsx
│           │   └── mobile-menu.tsx
│           ├── product/
│           │   ├── product-card.tsx
│           │   ├── product-grid.tsx
│           │   ├── product-filters.tsx
│           │   └── product-details.tsx
│           ├── cart/
│           │   ├── cart-page.tsx
│           │   ├── cart-sidebar.tsx
│           │   └── negotiation-modal.tsx
│           ├── account/
│           │   ├── profile-page.tsx
│           │   ├── orders-page.tsx
│           │   ├── wallet-page.tsx
│           │   └── ...
│           ├── services/
│           │   ├── repairs-page.tsx
│           │   ├── swap-page.tsx
│           │   └── imei-checker.tsx
│           ├── widgets/
│           │   ├── chat-widget.tsx
│           │   ├── toast-notifications.tsx
│           │   └── comparison-drawer.tsx
│           └── pages/
│               ├── home.tsx
│               ├── category.tsx
│               └── content-pages.tsx
├── app/
│   └── storefront/
│       └── [slug]/
│           ├── page.tsx
│           ├── category/
│           │   └── [category]/
│           │       └── page.tsx
│           ├── product/
│           │   └── [id]/
│           │       └── page.tsx
│           ├── cart/
│           │   └── page.tsx
│           ├── account/
│           │   ├── page.tsx
│           │   ├── orders/
│           │   ├── wallet/
│           │   └── ...
│           ├── repairs/
│           │   └── page.tsx
│           ├── swap/
│           │   └── page.tsx
│           └── imei/
│               └── page.tsx
└── contexts/
    └── ogabassey/
        ├── cart-context.tsx
        ├── saved-context.tsx
        └── comparison-context.tsx
```

---

## Conversion Priority Order

1. **HIGH** - Core shopping flow (Navbar, Home, Category, Product, Cart)
2. **MEDIUM** - Account pages (Profile, Orders, Wallet)
3. **MEDIUM** - Special services (Repairs, Swap, IMEI)
4. **LOW** - Content pages (About, Privacy, etc.)
5. **LOW** - Enhancements (Chat widget, Comparison, etc.)

---

## Notes

- All components must use Shadcn/UI where possible
- All forms must use React Hook Form + Zod
- All data fetching via Baci's existing API patterns
- Maintain Ogabassey's brand colors (red: #FF0000, dark: #1a1a1a)
- Keep festive theme support (Santa mode)
