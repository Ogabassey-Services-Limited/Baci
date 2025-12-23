# E-Commerce Product Schema Analysis

## Current Product Schema (Database)

```sql
products (
    id UUID PRIMARY KEY,
    merchant_id UUID REFERENCES merchants(id),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL NOT NULL,
    image_small TEXT,
    image_large TEXT,
    image_hint TEXT,
    stock_quantity INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    manage_stock BOOLEAN DEFAULT true,
    fulfillment_fields JSONB,
    has_variants BOOLEAN DEFAULT false,
    category TEXT,
    fulfillment_details JSONB,
    brand TEXT
)
```

---

## Comprehensive E-Commerce Product Schema Checklist

### ✅ What You Have (Good Foundation!)

**Product Identification:**
- ✅ `id` - Unique identifier
- ✅ `name` - Product name
- ✅ `description` - Product description
- ✅ `brand` - Brand/manufacturer

**Pricing:**
- ✅ `price` - Selling price

**Inventory:**
- ✅ `stock_quantity` - Current stock level
- ✅ `manage_stock` - Toggle inventory tracking

**Product Organization:**
- ✅ `category` - Product categorization

**Media:**
- ✅ `image_small` - Thumbnail
- ✅ `image_large` - Full-size image
- ✅ `image_hint` - AI image description

**Status:**
- ✅ `is_active` - Publish/unpublish toggle

**Variants:**
- ✅ `has_variants` - Variant support flag
- ✅ Separate `product_variants` table (good architecture!)

**System:**
- ✅ `created_at` - Creation timestamp
- ✅ `updated_at` - Last modified timestamp
- ✅ `merchant_id` - Multi-tenant support

**Custom:**
- ✅ `fulfillment_fields` - Flexible tracking (IMEI, S/N, etc.)
- ✅ `fulfillment_details` - Custom product metadata

---

## ❌ Missing Critical Fields

### **Priority 1: Essential for Basic E-Commerce**

#### **1. SKU (Stock Keeping Unit)**
```sql
ALTER TABLE products ADD COLUMN sku TEXT UNIQUE;
CREATE INDEX idx_products_sku ON products(merchant_id, sku);
```
**Why:** Internal inventory tracking, integrations with warehouses, accounting systems

#### **2. Slug (SEO-Friendly URL)**
```sql
ALTER TABLE products ADD COLUMN slug TEXT;
CREATE UNIQUE INDEX idx_products_slug ON products(merchant_id, slug);
```
**Why:** Clean URLs like `/products/iphone-15-pro` instead of `/products/uuid-123`

#### **3. Multiple Images**
**Current:** Only 1 image (image_small, image_large)
**Need:** Array of images

**Option A: Add column**
```sql
ALTER TABLE products ADD COLUMN images JSONB DEFAULT '[]';
-- Structure: [{ url: 'https://...', alt: 'description', order: 0 }]
```

**Option B: Separate table (better for many images)**
```sql
CREATE TABLE product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    alt_text TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **4. Compare At Price (Original Price)**
```sql
ALTER TABLE products ADD COLUMN compare_at_price DECIMAL;
```
**Why:** Show discounts: ~~$199.99~~ **$149.99**

#### **5. Weight & Dimensions (Shipping)**
```sql
ALTER TABLE products
    ADD COLUMN weight_value DECIMAL,
    ADD COLUMN weight_unit TEXT DEFAULT 'kg',
    ADD COLUMN length DECIMAL,
    ADD COLUMN width DECIMAL,
    ADD COLUMN height DECIMAL,
    ADD COLUMN dimensions_unit TEXT DEFAULT 'cm';
```
**Why:** Calculate shipping costs, shipping carrier integrations

#### **6. Low Stock Threshold**
```sql
ALTER TABLE products
    ADD COLUMN low_stock_threshold INTEGER DEFAULT 10;
```
**Why:** Alert merchants when inventory is running low

---

### **Priority 2: Important for Professional Stores**

#### **7. SEO Fields**
```sql
ALTER TABLE products
    ADD COLUMN meta_title TEXT,
    ADD COLUMN meta_description TEXT,
    ADD COLUMN seo_keywords TEXT[];
```
**Why:** Google search visibility, social media sharing

#### **8. Product Status (Beyond Active/Inactive)**
```sql
ALTER TABLE products
    ADD COLUMN status TEXT DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'archived'));
-- Migrate existing data
UPDATE products SET status = CASE WHEN is_active THEN 'active' ELSE 'draft' END;
```
**Why:**
- `draft` - Not visible to customers
- `active` - Live on storefront
- `archived` - Hidden but keep data

#### **9. Tags (Flexible Filtering)**
```sql
ALTER TABLE products ADD COLUMN tags TEXT[] DEFAULT '{}';
CREATE INDEX idx_products_tags ON products USING GIN(tags);
```
**Why:** Cross-category filtering: "summer", "sale", "eco-friendly"

#### **10. Tax Configuration**
```sql
ALTER TABLE products
    ADD COLUMN taxable BOOLEAN DEFAULT true,
    ADD COLUMN tax_code TEXT; -- For services like Avalara
```
**Why:** Tax calculation, compliance

#### **11. Cost Price (Profit Tracking)**
```sql
ALTER TABLE products ADD COLUMN cost_price DECIMAL;
```
**Why:** Calculate profit margins, analytics

#### **12. Condition**
```sql
ALTER TABLE products
    ADD COLUMN condition TEXT DEFAULT 'new'
        CHECK (condition IN ('new', 'used', 'refurbished'));
```
**Why:** Sell used/refurbished items

---

### **Priority 3: Advanced Features**

#### **13. Published At (Schedule Publishing)**
```sql
ALTER TABLE products ADD COLUMN published_at TIMESTAMPTZ;
```
**Why:** Schedule product launches

#### **14. Featured Flag**
```sql
ALTER TABLE products ADD COLUMN featured BOOLEAN DEFAULT false;
CREATE INDEX idx_products_featured ON products(merchant_id, featured) WHERE featured = true;
```
**Why:** Highlight products on homepage

#### **15. Allow Backorder**
```sql
ALTER TABLE products ADD COLUMN allow_backorder BOOLEAN DEFAULT false;
```
**Why:** Accept orders even when out of stock

#### **16. Requires Shipping**
```sql
ALTER TABLE products ADD COLUMN requires_shipping BOOLEAN DEFAULT true;
```
**Why:** Digital products don't need shipping

#### **17. Barcode/GTIN**
```sql
ALTER TABLE products
    ADD COLUMN barcode TEXT,
    ADD COLUMN barcode_type TEXT; -- 'UPC', 'EAN', 'ISBN', etc.
```
**Why:** Scan products, integrations with POS systems

#### **18. Minimum/Maximum Order Quantity**
```sql
ALTER TABLE products
    ADD COLUMN min_order_quantity INTEGER DEFAULT 1,
    ADD COLUMN max_order_quantity INTEGER;
```
**Why:** Wholesale (min 10), limited editions (max 2 per customer)

#### **19. Video URL**
```sql
ALTER TABLE products ADD COLUMN video_url TEXT;
```
**Why:** Product demos increase conversions

#### **20. Average Rating (Denormalized)**
```sql
ALTER TABLE products
    ADD COLUMN average_rating DECIMAL(3,2) DEFAULT 0,
    ADD COLUMN review_count INTEGER DEFAULT 0;
```
**Why:** Fast display without joining reviews table

---

## 🎯 Recommended Implementation Phases

### **Phase 1: Critical Foundation (Do Now)**
1. ✅ Add `sku` column
2. ✅ Add `slug` column
3. ✅ Add `compare_at_price` column
4. ✅ Add multiple images support (JSONB or separate table)
5. ✅ Add `low_stock_threshold` column
6. ✅ Add shipping fields (weight, dimensions)

### **Phase 2: Professional Features (Next Sprint)**
7. ✅ Add SEO fields (meta_title, meta_description)
8. ✅ Improve status field (draft/active/archived)
9. ✅ Add tags array
10. ✅ Add tax configuration
11. ✅ Add `cost_price` for profit tracking

### **Phase 3: Advanced (Future)**
12. ✅ Schedule publishing
13. ✅ Featured products
14. ✅ Backorder support
15. ✅ Barcode/GTIN
16. ✅ Min/max order quantities
17. ✅ Video support
18. ✅ Reviews/ratings integration

---

## 📦 Comparison with Major Platforms

### **Shopify Product Fields:**
- Basic info: ✅ (you have)
- SKU: ❌ (missing)
- Barcode: ❌ (missing)
- Inventory: ✅ (you have)
- Variants: ✅ (you have)
- Images: ⚠️ (limited to 1)
- SEO: ❌ (missing)
- Shipping: ❌ (missing weight/dimensions)
- Tags: ❌ (missing)
- Collections: ❌ (missing)

### **WooCommerce Product Fields:**
- Similar gaps to Shopify comparison
- They have: regular price, sale price (compare_at_price)
- They have: shipping class, weight, dimensions
- They have: downloadable products flag

### **BigCommerce Product Fields:**
- They have: condition (new/used/refurbished)
- They have: warranty information
- They have: availability text ("In Stock", "2-3 days")
- They have: search keywords

---

## 🚨 Most Critical Missing Fields

If you only add 5 things, add these:

1. **`sku`** - Essential for inventory management
2. **`slug`** - Clean URLs for SEO
3. **Multiple images** - Customers need to see products from different angles
4. **`weight` + `dimensions`** - Required for shipping calculations
5. **`compare_at_price`** - Show discounts/sales

---

## 💡 Special Considerations for Your Platform

Since you're building a **multi-tenant e-commerce platform** (like Shopify):

### **Good Decisions You've Made:**
- ✅ `merchant_id` for multi-tenancy
- ✅ `has_variants` + separate variants table
- ✅ `fulfillment_fields` JSONB for flexibility
- ✅ `manage_stock` toggle

### **Consider Adding:**
- **`vendor`** field if you support marketplace model (multiple vendors per merchant)
- **`product_type`** (physical, digital, service) for different handling
- **Currency support** if merchants operate internationally
- **Collections/Categories hierarchy** (current category is flat)

---

## 🎨 UI Considerations

When adding these fields, consider:

1. **Product form will get long** → Use tabs:
   - Basic Info (name, description, price)
   - Inventory (SKU, stock, variants)
   - Shipping (weight, dimensions)
   - SEO (meta fields, slug)
   - Media (images, video)

2. **Not all fields are required** → Show/hide based on product type
   - Digital products: hide shipping fields
   - Services: hide inventory fields

3. **Smart defaults** → Most merchants won't fill everything
   - Auto-generate slug from name
   - Default weight/dimensions to store settings
   - Auto-calculate meta_description from description

---

## 🔧 Ready-to-Run Migration

Want me to create a migration that adds the **Phase 1 critical fields**?

I can generate:
```sql
-- Migration: add_critical_product_fields
ALTER TABLE products
    ADD COLUMN sku TEXT,
    ADD COLUMN slug TEXT,
    ADD COLUMN compare_at_price DECIMAL,
    ADD COLUMN images JSONB DEFAULT '[]',
    ADD COLUMN low_stock_threshold INTEGER DEFAULT 10,
    ADD COLUMN weight_value DECIMAL,
    ADD COLUMN weight_unit TEXT DEFAULT 'kg',
    ADD COLUMN length DECIMAL,
    ADD COLUMN width DECIMAL,
    ADD COLUMN height DECIMAL,
    ADD COLUMN dimensions_unit TEXT DEFAULT 'cm';

-- Add constraints and indexes
CREATE INDEX idx_products_sku ON products(merchant_id, sku);
CREATE INDEX idx_products_slug ON products(merchant_id, slug);
```

Let me know which phase you want to implement!
