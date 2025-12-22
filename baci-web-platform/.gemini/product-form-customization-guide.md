# Product Form Customization Guide

## Overview
The Baci product form automatically adapts based on the merchant's business category. This guide explains how to view and customize the form for each business type.

## Business Categories & Their Customizations

### 1. **Electronics & Gadgets** (`electronics`)
**Category Config Key:** `electronics-gadgets`

**Product Categories:**
- Smartphones
- Laptops
- Tablets
- Audio
- Cameras
- Gaming
- Wearables
- Accessories

**Variant Attributes:**
- **Color** (with images) - Required
- **RAM** - Options: 2GB, 4GB, 6GB, 8GB, 12GB, 16GB, 18GB, 24GB, 32GB, 48GB, 64GB, 96GB, 128GB, 192GB, 256GB
- **Storage Capacity** - Options: 16GB, 32GB, 64GB, 128GB, 256GB, 512GB, 1TB, 2TB

**Fulfillment Identifiers:**
- Serial Number (S/N)
- IMEI (for mobile devices)
- MAC Address (for network devices)
- SKU

---

### 2. **Fashion & Apparel** (`fashion`)
**Category Config Key:** `fashion-apparel`

**Product Categories:**
- Tops
- Bottoms
- Dresses
- Outerwear
- Footwear
- Bags
- Jewelry
- Accessories
- Traditional Wear

**Variant Attributes:**
- **Size** - Options: XXS, XS, S, M, L, XL, XXL, XXXL - Required
- **Color** (with images) - Required
- **Material** - Options: Cotton, Polyester, Denim, Leather, Silk, Ankara, Lace, Aso-oke
- **Pattern** - Options: Plain, Striped, Floral, Geometric, Printed

**Fulfillment Identifiers:**
- SKU
- Barcode
- UPC

---

### 3. **Beauty & Personal Care** (`health-beauty`)
**Category Config Key:** `beauty-personal-care`

**Product Categories:**
- Makeup
- Skincare
- Haircare
- Fragrances
- Bath & Body
- Nail Care
- Tools & Brushes

**Variant Attributes:**
- **Shade/Color** (with images)
- **Size/Volume** - Options: 15ml, 30ml, 50ml, 100ml, 200ml, 500ml, Travel Size, Full Size
- **Finish** - Options: Matte, Glossy, Satin, Shimmer, Dewy
- **Skin Type** - Options: Normal, Dry, Oily, Combination, Sensitive, All Skin Types

**Fulfillment Identifiers:**
- Batch Number
- Lot Number
- SKU

---

### 4. **Health & Wellness** (`health-beauty` - mapped to `health-wellness`)
**Category Config Key:** `health-wellness`

**Product Categories:**
- Supplements
- Vitamins
- Herbal Products
- Fitness Equipment
- Wellness Drinks
- Weight Management

**Variant Attributes:**
- **Quantity/Size** - Options: 30 Capsules, 60 Capsules, 90 Capsules, 500g, 1kg, Small, Medium, Large
- **Flavor** - Options: Unflavored, Chocolate, Vanilla, Strawberry, Mixed Berry

**Fulfillment Identifiers:**
- Batch Number
- Lot Number
- Expiry Date

---

### 5. **Food & Beverage** (`food-beverage`)
**Category Config Key:** `groceries-food`

**Product Categories:**
- Grains & Staples
- Oils & Fats
- Spices
- Snacks
- Beverages
- Packaged Foods
- Fresh Produce

**Variant Attributes:**
- **Weight/Volume** - Options: 100g, 250g, 500g, 1kg, 2kg, 5kg, 250ml, 500ml, 1L
- **Packaging Type** - Options: Sachet, Bottle, Can, Pouch, Carton, Jar

**Fulfillment Identifiers:**
- Batch Number
- Manufacturing Date
- Expiry Date

---

### 6. **Home Goods & Decor** (`home-goods`)
**Category Config Key:** `home-living`

**Product Categories:**
- Furniture
- Decor
- Kitchen & Dining
- Bedding
- Storage
- Lighting
- Cleaning Supplies

**Variant Attributes:**
- **Color** (with images)
- **Size/Dimensions** - Options: Small, Medium, Large, Queen, King, Custom
- **Material** - Options: Wood, Metal, Plastic, Glass, Fabric, Ceramic

**Fulfillment Identifiers:**
- SKU
- Item Number

---

### 7. **Handmade & Crafts** (`handmade`)
**Category Config Key:** `handmade-crafts`

**Product Categories:**
- Jewelry
- Art & Paintings
- Sculptures
- Textile Crafts
- Leather Goods
- Pottery
- Custom Items

**Variant Attributes:**
- **Color** (with images)
- **Size** - Options: Small, Medium, Large, Custom
- **Material** - Free text input

**Fulfillment Identifiers:**
- Piece Number (for unique items)
- Artist ID

---

### 8. **Digital Products** (No variant mapping yet)
**Category Config Key:** `digital-products`

**Product Categories:**
- E-books
- Courses
- Templates
- Software
- Music & Audio
- Graphics

**Variant Attributes:**
- None (variants disabled for digital products)

**Fulfillment Identifiers:**
- License Key
- Activation Code
- Order ID

---

## How to Test Different Forms

### Option 1: Create Test Merchants
1. Create multiple merchant accounts with different business types
2. Log in as each merchant
3. Navigate to Products → Add Product
4. Observe how the form changes

### Option 2: Temporarily Change Business Type
1. Go to your database (Supabase)
2. Update the `merchants` table
3. Change the `business_type` field to test different categories
4. Refresh the app

### Option 3: Use Browser DevTools
1. Open the product form
2. Open browser console
3. Temporarily modify the merchant context

## How to Customize

### Adding New Variant Options
Edit `/src/lib/category-configs.ts`:

```typescript
'electronics-gadgets': {
    // ... existing config
    variantAttributes: [
        { 
            key: 'color', 
            label: 'Color', 
            type: 'color', 
            hasImage: true, 
            required: true 
        },
        { 
            key: 'ram', 
            label: 'RAM', 
            type: 'select', 
            options: ['2GB', '4GB', '6GB', '8GB', '12GB', '16GB'] // Add more here
        },
        // Add new attribute:
        { 
            key: 'processor', 
            label: 'Processor', 
            type: 'select', 
            options: ['Intel i5', 'Intel i7', 'AMD Ryzen 5', 'AMD Ryzen 7']
        },
    ],
}
```

### Adding New Product Categories
```typescript
'electronics-gadgets': {
    // ... existing config
    productCategories: [
        'Smartphones', 
        'Laptops', 
        'Tablets',
        'Smart Home Devices', // Add new category
    ],
}
```

### Adding New Fulfillment Identifiers
```typescript
'electronics-gadgets': {
    // ... existing config
    fulfillmentIdentifiers: [
        { value: 'S/N', label: 'Serial Number', description: 'Manufacturer-assigned unique identifier' },
        { value: 'IMEI', label: 'IMEI', description: 'For mobile devices (15-digit number)' },
        // Add new identifier:
        { value: 'WARRANTY', label: 'Warranty Code', description: 'Product warranty tracking code' },
    ],
}
```

## File Structure

```
src/
├── lib/
│   └── category-configs.ts          # Main configuration file
├── app/
│   └── dashboard/
│       └── products/
│           └── add/
│               └── add-product-form.tsx  # Form component
└── components/
    └── products/
        └── variant-builder.tsx       # Variant builder component
```

## Testing Checklist

- [ ] Test each business category
- [ ] Verify category dropdown shows correct options
- [ ] Test variant builder with different attributes
- [ ] Verify fulfillment identifiers appear correctly
- [ ] Test form validation
- [ ] Test AI autofill for each category
- [ ] Verify variants save correctly

## Common Customization Tasks

### 1. Add a new size option for fashion
Location: `category-configs.ts` → `fashion-apparel` → `variantAttributes` → `size` → `options`

### 2. Add a new RAM option for electronics
Location: `category-configs.ts` → `electronics-gadgets` → `variantAttributes` → `ram` → `options`

### 3. Add a new product category
Location: `category-configs.ts` → `[category-key]` → `productCategories`

### 4. Make an attribute required
Location: `category-configs.ts` → `[category-key]` → `variantAttributes` → add `required: true`

### 5. Enable image uploads for a variant attribute
Location: `category-configs.ts` → `[category-key]` → `variantAttributes` → add `hasImage: true`
