# Vertical Features Roadmap

> **Last Updated:** November 2025
> **Status:** Planning & Research Complete
> **Related Files:**
> - `/src/features/registry.ts` - Feature registry implementation
> - `/src/config/business-types.ts` - Business type configuration
> - `/supabase/migrations/20251126180000_create_vertical_features.sql` - Database schema

---

## Overview

Baci is a multi-tenant vertical SaaS e-commerce platform. Each business type (vertical) has specialized features that cater to their unique needs, while universal features (payment, shipping) work across all verticals.

### Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                         BACI PLATFORM                                   │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌───────────┐  │
│   │   FASHION   │   │ ELECTRONICS │   │    FOOD     │   │  HANDMADE │  │
│   │  VERTICAL   │   │  VERTICAL   │   │  VERTICAL   │   │  VERTICAL │  │
│   ├─────────────┤   ├─────────────┤   ├─────────────┤   ├───────────┤  │
│   │ • Size Guide│   │ • IMEI/S/N  │   │ • Nutrition │   │ • Custom  │  │
│   │ • AI Try-On │   │ • Warranty  │   │ • Allergens │   │   Orders  │  │
│   │ • Lookbooks │   │ • Specs     │   │ • Expiry    │   │ • Maker   │  │
│   │ • Colors    │   │ • Compare   │   │ • Dietary   │   │   Story   │  │
│   └─────────────┘   └─────────────┘   └─────────────┘   └───────────┘  │
│                                                                        │
│   ┌───────────────────────────────────────────────────────────────┐   │
│   │                    UNIVERSAL FEATURES                          │   │
│   │  • Payment Providers (Stripe, PayPal, Paystack, Flutterwave)  │   │
│   │  • Shipping Providers (DHL, FedEx, Local Couriers)            │   │
│   │  • Core E-commerce (Cart, Checkout, Orders, Inventory)        │   │
│   │  • SEO, Analytics, Themes, Puck Builder                       │   │
│   └───────────────────────────────────────────────────────────────┘   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Feature Categories

Features are organized into categories based on where they apply:

| Category | Description | Examples |
|----------|-------------|----------|
| `storefront` | Customer-facing pages | Virtual try-on, comparison tools, quizzes |
| `product` | Product display/management | Size guides, nutrition facts, specs |
| `checkout` | Checkout process | Gift wrap, custom orders, extended warranty |
| `inventory` | Inventory management | IMEI tracking, expiry dates, batch tracking |
| `analytics` | Reporting & insights | Vertical-specific metrics |

---

## 1. Fashion & Apparel

### Business Context
- Average e-commerce return rate: **16.9%** (2024), with clothing being top category
- **65%** more likely to purchase after AR interaction
- Virtual fitting rooms can reduce returns by **40%+**

### Storefront Features

| Feature | Key | Description | Priority | Complexity |
|---------|-----|-------------|----------|------------|
| AI Virtual Try-On | `ai_tryon` | AR technology letting customers visualize clothes on themselves | Premium | Very High |
| Lookbook Gallery | `lookbook_gallery` | Styled outfit collections showing products in context | Medium | Medium |
| Outfit Builder | `outfit_builder` | Let customers create complete outfits from catalog | Low | High |
| Style Quiz | `style_quiz` | Personalized style recommendations | Low | Medium |

### Product Features

| Feature | Key | Description | Priority | Complexity |
|---------|-----|-------------|----------|------------|
| Size Guide Builder | `size_guide` | Interactive size charts with body measurements | **High** | Medium |
| Color Swatches | `color_variants` | Visual color variant selector with fabric photos | **High** | Low |
| Material & Care | `material_info` | Fabric composition, washing instructions | Medium | Low |
| Fit Predictor | `fit_predictor` | AI-powered size recommendations | Low | High |

### Checkout Features

| Feature | Key | Description | Priority | Complexity |
|---------|-----|-------------|----------|------------|
| Gift Wrap | `gift_wrap` | Gift wrapping option at checkout | Low | Low |
| Personalization | `personalization` | Add monograms, custom text | Low | Medium |

### Puck Components to Build

```
src/components/builder/verticals/fashion/
├── SizeGuideSection.tsx      # Interactive size chart display
├── ColorSwatches.tsx         # Visual color picker component
├── LookbookGallery.tsx       # Outfit/lifestyle image gallery
├── MaterialCareCard.tsx      # Fabric & care instructions
└── FitPredictor.tsx          # Size recommendation widget
```

### Product Form Fields

```typescript
const fashionProductFields = [
  { key: 'sizes', type: 'size-chart-builder', label: 'Size Chart' },
  { key: 'colors', type: 'color-swatch-picker', label: 'Available Colors' },
  { key: 'materials', type: 'multi-select', label: 'Materials',
    options: ['Cotton', 'Polyester', 'Silk', 'Wool', 'Linen', 'Cashmere', 'Denim', 'Leather'] },
  { key: 'care_instructions', type: 'care-label-builder', label: 'Care Instructions' },
  { key: 'fit_type', type: 'select', label: 'Fit',
    options: ['Slim', 'Regular', 'Relaxed', 'Oversized'] },
  { key: 'model_measurements', type: 'text', label: 'Model Measurements',
    placeholder: "Model is 5'10\" wearing size M" },
  { key: 'gender', type: 'select', label: 'Gender',
    options: ['Men', 'Women', 'Unisex', 'Kids'] },
];
```

### Third-Party Integrations
- **Virtual Try-On:** [Reactive Reality](https://www.reactivereality.com/), [3DLook](https://3dlook.ai/)
- **Size Recommendations:** [Fitnonce](https://fitnonce.com/), [Sizebay](https://sizebay.com/)

---

## 2. Electronics & Gadgets

### Business Context
- Serial/IMEI tracking critical for warranty claims and fraud prevention
- **38%** of top e-commerce sites have comparison tools
- Spec-heavy products need clear, organized information

### Storefront Features

| Feature | Key | Description | Priority | Complexity |
|---------|-----|-------------|----------|------------|
| Spec Comparison | `spec_comparison` | Side-by-side product comparison table | **High** | Medium |
| Compatibility Checker | `compatibility_checker` | Check if accessories work with devices | Medium | Medium |
| Tech Specs Display | `tech_specs_display` | Detailed specifications in sections | Medium | Low |

### Product Features

| Feature | Key | Description | Priority | Complexity |
|---------|-----|-------------|----------|------------|
| Technical Specs | `tech_specs` | Organized specification table | **High** | Low |
| Warranty Info | `warranty_management` | Warranty terms, registration | **High** | Low |
| What's in Box | `box_contents` | List of included items | Medium | Low |

### Inventory Features

| Feature | Key | Description | Priority | Complexity |
|---------|-----|-------------|----------|------------|
| IMEI Tracking | `imei_tracking` | Track devices by IMEI/serial | **High** | Medium |
| Batch Tracking | `batch_tracking` | Track by manufacturing batch | Low | Low |

### Checkout Features

| Feature | Key | Description | Priority | Complexity |
|---------|-----|-------------|----------|------------|
| Extended Warranty | `extended_warranty` | Upsell extended warranty | Medium | Medium |
| Insurance | `insurance` | Device protection plans | Low | Medium |

### Puck Components to Build

```
src/components/builder/verticals/electronics/
├── SpecComparison.tsx        # Side-by-side comparison table
├── TechSpecsSection.tsx      # Organized specs display
├── WarrantyInfoCard.tsx      # Warranty terms display
├── BoxContents.tsx           # What's in the box list
└── CompatibilityChecker.tsx  # Device compatibility tool
```

### Product Form Fields

```typescript
const electronicsProductFields = [
  { key: 'imei', type: 'imei-input', label: 'IMEI Number', validation: 'luhn-15' },
  { key: 'serial_number', type: 'text', label: 'Serial Number' },
  { key: 'warranty_months', type: 'number', label: 'Warranty Period (Months)' },
  { key: 'warranty_type', type: 'select', label: 'Warranty Type',
    options: ['Manufacturer', 'Seller', 'Extended', 'No Warranty'] },
  { key: 'specs', type: 'spec-builder', label: 'Technical Specifications',
    categories: ['Display', 'Performance', 'Camera', 'Battery', 'Connectivity', 'Storage'] },
  { key: 'compatibility', type: 'multi-select', label: 'Compatible With' },
  { key: 'box_contents', type: 'list-builder', label: "What's in the Box" },
  { key: 'condition', type: 'select', label: 'Condition',
    options: ['New', 'Open Box', 'Refurbished - Excellent', 'Refurbished - Good', 'Used'] },
];
```

### Comparison Table Best Practices
- Display comparable, meaningful attributes only
- Use tick marks/icons for boolean features
- Enable horizontal scrolling on mobile
- Use collapsible sections for progressive disclosure
- Highlight differences with subtle color coding

---

## 3. Food & Beverage

### Business Context
- Only **36.5%** of online food products have legible nutrition info
- Allergen disclosure present on only **11.4%** of products that contain allergens
- FDA requires nutrition facts, allergens, ingredients on physical packaging (not online yet)

### Storefront Features

| Feature | Key | Description | Priority | Complexity |
|---------|-----|-------------|----------|------------|
| Dietary Filters | `dietary_filters` | Filter by vegan, halal, kosher, etc. | **High** | Low |
| Recipe Suggestions | `recipe_suggestions` | Show recipes using products | Medium | Medium |
| Pairing Guide | `pairing_guide` | Food/wine pairing recommendations | Low | Medium |

### Product Features

| Feature | Key | Description | Priority | Complexity |
|---------|-----|-------------|----------|------------|
| Nutrition Facts | `nutrition_facts` | FDA-style nutrition label | **High** | Medium |
| Allergen Warnings | `allergen_info` | Prominent allergen badges | **High** | Low |
| Ingredient List | `ingredient_list` | Full ingredient breakdown | **High** | Low |

### Inventory Features

| Feature | Key | Description | Priority | Complexity |
|---------|-----|-------------|----------|------------|
| Expiry Tracking | `expiry_tracking` | Track expiration dates, FIFO | **High** | Medium |
| Batch/Lot Tracking | `batch_tracking` | For recalls and QC | Medium | Low |

### Puck Components to Build

```
src/components/builder/verticals/food/
├── NutritionFactsPanel.tsx   # FDA-style nutrition label
├── AllergenBadges.tsx        # Prominent allergen warnings
├── IngredientList.tsx        # Full ingredient breakdown
├── DietaryFilterBar.tsx      # Filter by dietary preference
├── RecipeGallery.tsx         # Recipe suggestions carousel
└── PairingGuide.tsx          # Food/wine pairing section
```

### Product Form Fields

```typescript
const foodBeverageProductFields = [
  { key: 'nutrition_facts', type: 'nutrition-builder', label: 'Nutrition Facts',
    fields: ['calories', 'fat', 'saturated_fat', 'trans_fat', 'cholesterol',
             'sodium', 'carbs', 'fiber', 'sugars', 'protein', 'vitamins'] },
  { key: 'ingredients', type: 'ingredient-list', label: 'Ingredients' },
  { key: 'allergens', type: 'multi-select', label: 'Contains Allergens', required: true,
    options: ['Milk', 'Eggs', 'Fish', 'Shellfish', 'Tree Nuts', 'Peanuts',
              'Wheat', 'Soybeans', 'Sesame'] },
  { key: 'dietary_tags', type: 'multi-select', label: 'Dietary',
    options: ['Vegan', 'Vegetarian', 'Gluten-Free', 'Halal', 'Kosher',
              'Organic', 'Non-GMO', 'Keto', 'Paleo'] },
  { key: 'shelf_life_days', type: 'number', label: 'Shelf Life (Days)' },
  { key: 'storage_temp', type: 'select', label: 'Storage Temperature',
    options: ['Room Temperature', 'Refrigerated', 'Frozen'] },
  { key: 'storage_instructions', type: 'textarea', label: 'Storage Instructions' },
  { key: 'serving_size', type: 'text', label: 'Serving Size' },
  { key: 'servings_per_container', type: 'number', label: 'Servings Per Container' },
];
```

### Common Allergens (FDA Big 9)
1. Milk
2. Eggs
3. Fish
4. Shellfish
5. Tree Nuts
6. Peanuts
7. Wheat
8. Soybeans
9. Sesame (added 2023)

---

## 4. Health & Beauty

### Business Context
- Personalized skincare quizzes drive conversions significantly
- Ingredient transparency is increasingly important to consumers
- Routine building helps with cross-selling and customer retention

### Storefront Features

| Feature | Key | Description | Priority | Complexity |
|---------|-----|-------------|----------|------------|
| Skin Type Quiz | `skin_type_quiz` | Personalized product recommendations | Medium | High |
| Routine Builder | `routine_builder` | Build AM/PM skincare routines | Medium | High |
| Before/After Gallery | `before_after` | Product results with user photos | **High** | Medium |
| Ingredient Spotlight | `ingredient_spotlight` | Educational content on ingredients | Low | Low |

### Product Features

| Feature | Key | Description | Priority | Complexity |
|---------|-----|-------------|----------|------------|
| Ingredient List | `ingredient_list` | Full INCI ingredient breakdown | **High** | Low |
| Skin Concern Tags | `skin_concern_tags` | Filter by acne, aging, etc. | **High** | Low |
| Usage Instructions | `usage_instructions` | How/when to apply | Medium | Low |
| Skin Type Filters | `skin_type_filters` | Filter by skin type | **High** | Low |

### Puck Components to Build

```
src/components/builder/verticals/beauty/
├── SkinTypeQuiz.tsx          # Multi-step skin analysis quiz
├── RoutineBuilder.tsx        # AM/PM routine creation tool
├── BeforeAfterGallery.tsx    # Results gallery with slider
├── IngredientBreakdown.tsx   # INCI ingredient analysis
├── SkinConcernTags.tsx       # Filterable concern badges
└── UsageInstructions.tsx     # Step-by-step usage guide
```

### Product Form Fields

```typescript
const healthBeautyProductFields = [
  { key: 'ingredients_inci', type: 'ingredient-list', label: 'Full Ingredient List (INCI)' },
  { key: 'key_ingredients', type: 'multi-select', label: 'Key Active Ingredients',
    options: ['Vitamin C', 'Retinol', 'Hyaluronic Acid', 'Niacinamide', 'Salicylic Acid',
              'AHA', 'BHA', 'Peptides', 'Ceramides', 'Squalane', 'Vitamin E'] },
  { key: 'skin_types', type: 'multi-select', label: 'Suitable for Skin Types',
    options: ['Normal', 'Dry', 'Oily', 'Combination', 'Sensitive', 'Acne-Prone', 'Mature'] },
  { key: 'skin_concerns', type: 'multi-select', label: 'Addresses Concerns',
    options: ['Acne', 'Aging', 'Dark Spots', 'Dryness', 'Dullness', 'Large Pores',
              'Redness', 'Wrinkles', 'Uneven Tone', 'Dehydration'] },
  { key: 'routine_step', type: 'select', label: 'Routine Step',
    options: ['Cleanser', 'Toner', 'Essence', 'Serum', 'Ampoule', 'Moisturizer',
              'Eye Cream', 'Sunscreen', 'Mask', 'Exfoliator', 'Treatment'] },
  { key: 'usage_time', type: 'multi-select', label: 'When to Use',
    options: ['Morning (AM)', 'Evening (PM)'] },
  { key: 'volume_ml', type: 'number', label: 'Volume (ml)' },
  { key: 'usage_instructions', type: 'textarea', label: 'How to Use' },
  { key: 'fragrance_free', type: 'boolean', label: 'Fragrance Free' },
  { key: 'cruelty_free', type: 'boolean', label: 'Cruelty Free' },
];
```

### Skincare Routine Steps (Typical Order)
1. **Cleanser** - Remove dirt, makeup, debris
2. **Toner** - Balance pH, prep skin
3. **Essence** - Hydration base layer
4. **Serum/Ampoule** - Targeted treatment
5. **Eye Cream** - Delicate eye area
6. **Moisturizer** - Lock in hydration
7. **Sunscreen** (AM only) - UV protection

---

## 5. Home Goods & Decor

### Business Context
- Customers are **11x more likely to buy furniture** after viewing in AR
- 3D visualization increases order volumes by **27%**
- Dimensions and fit are critical for reducing returns

### Storefront Features

| Feature | Key | Description | Priority | Complexity |
|---------|-----|-------------|----------|------------|
| AR Room Visualizer | `room_visualizer` | Place furniture in room via AR | Premium | Very High |
| Style Collections | `style_collections` | Group by interior design style | Medium | Low |
| 3D Room Planner | `room_planner` | Plan layouts with dimensions | Low | Very High |
| Shop the Look | `shop_the_look` | Complete room setups | Medium | Medium |

### Product Features

| Feature | Key | Description | Priority | Complexity |
|---------|-----|-------------|----------|------------|
| Dimension Guide | `dimension_guide` | Detailed measurements with diagrams | **High** | Medium |
| 3D Product Viewer | `3d_viewer` | 360° rotate and zoom | Medium | High |
| Assembly Info | `assembly_info` | Requirements, time, tools | **High** | Low |
| Material Samples | `material_samples` | Order swatches | Low | Medium |

### Puck Components to Build

```
src/components/builder/verticals/home/
├── DimensionGuide.tsx        # Visual dimension display
├── Product3DViewer.tsx       # Interactive 3D model viewer
├── AssemblyInfo.tsx          # Assembly requirements card
├── StyleCollections.tsx      # Interior style galleries
├── ShopTheLook.tsx          # Room setup with all products
└── ARRoomVisualizer.tsx      # AR placement tool
```

### Product Form Fields

```typescript
const homeGoodsProductFields = [
  { key: 'dimensions', type: 'dimension-input', label: 'Dimensions',
    fields: [
      { key: 'length', label: 'Length', unit: 'cm' },
      { key: 'width', label: 'Width', unit: 'cm' },
      { key: 'height', label: 'Height', unit: 'cm' },
      { key: 'depth', label: 'Depth', unit: 'cm' },
      { key: 'seat_height', label: 'Seat Height', unit: 'cm', optional: true },
      { key: 'arm_height', label: 'Arm Height', unit: 'cm', optional: true },
    ]},
  { key: 'weight_kg', type: 'number', label: 'Weight (kg)' },
  { key: 'materials', type: 'multi-select', label: 'Materials',
    options: ['Solid Wood', 'Engineered Wood', 'Metal', 'Glass', 'Fabric',
              'Leather', 'Faux Leather', 'Plastic', 'Marble', 'Rattan', 'Bamboo'] },
  { key: 'wood_type', type: 'select', label: 'Wood Type', conditionalOn: 'materials.includes("Solid Wood")',
    options: ['Oak', 'Walnut', 'Pine', 'Teak', 'Mahogany', 'Maple', 'Cherry'] },
  { key: 'color_options', type: 'color-picker', label: 'Available Colors' },
  { key: 'assembly_required', type: 'select', label: 'Assembly',
    options: ['No Assembly Required', 'Simple (< 30 min)', 'Moderate (30-60 min)', 'Complex (> 60 min)'] },
  { key: 'assembly_tools', type: 'multi-select', label: 'Tools Required',
    options: ['None', 'Phillips Screwdriver', 'Flathead Screwdriver', 'Allen Key (Included)',
              'Allen Key (Not Included)', 'Drill', 'Hammer', 'Level'] },
  { key: 'room_type', type: 'multi-select', label: 'Room Type',
    options: ['Living Room', 'Bedroom', 'Dining Room', 'Home Office', 'Bathroom',
              'Kitchen', 'Entryway', 'Outdoor', 'Kids Room'] },
  { key: 'style', type: 'select', label: 'Style',
    options: ['Modern', 'Contemporary', 'Traditional', 'Transitional', 'Bohemian',
              'Scandinavian', 'Industrial', 'Mid-Century Modern', 'Farmhouse', 'Coastal'] },
  { key: '3d_model_url', type: 'file-upload', label: '3D Model (GLB/GLTF)', accept: '.glb,.gltf' },
];
```

### Third-Party Integrations
- **3D Visualization:** [Threekit](https://www.threekit.com/), [3D Cloud](https://3dcloud.com/)
- **AR:** [Roomle](https://www.roomle.com/), [VividWorks](https://www.vividworks.com/)

---

## 6. Handmade & Artisan

### Business Context
- **71%** of consumers expect personalization
- Etsy has 95+ million active buyers seeking unique, handcrafted items
- Story and craftsmanship create emotional connection

### Storefront Features

| Feature | Key | Description | Priority | Complexity |
|---------|-----|-------------|----------|------------|
| Maker Story | `maker_story` | Artisan profile and story | **High** | Low |
| Crafting Process | `crafting_process` | Step-by-step making gallery | Medium | Medium |
| Custom Order CTA | `custom_order_cta` | Prominent custom request form | **High** | Low |

### Product Features

| Feature | Key | Description | Priority | Complexity |
|---------|-----|-------------|----------|------------|
| Personalization Form | `personalization` | Custom text, colors, options | **High** | Medium |
| Limited Edition Badge | `limited_editions` | Edition number display | Medium | Low |
| Crafting Timeline | `crafting_time` | Expected creation time | **High** | Low |

### Checkout Features

| Feature | Key | Description | Priority | Complexity |
|---------|-----|-------------|----------|------------|
| Custom Order Form | `custom_orders` | Detailed customization inputs | **High** | Medium |
| Made-to-Order Notice | `made_to_order` | Creation time communication | Medium | Low |

### Puck Components to Build

```
src/components/builder/verticals/handmade/
├── MakerStorySection.tsx     # Artisan profile and story
├── CraftingProcessGallery.tsx # Step-by-step making process
├── PersonalizationForm.tsx   # Custom order input form
├── LimitedEditionBadge.tsx   # Edition number display
├── CraftingTimeline.tsx      # Creation time estimate
└── CustomOrderCTA.tsx        # Custom order request button
```

### Product Form Fields

```typescript
const handmadeProductFields = [
  { key: 'crafting_time', type: 'text', label: 'Crafting Time',
    placeholder: '3-5 business days' },
  { key: 'materials_used', type: 'textarea', label: 'Materials Used',
    placeholder: 'Describe the materials and their origin...' },
  { key: 'customization_available', type: 'boolean', label: 'Customization Available' },
  { key: 'customization_options', type: 'customization-builder', label: 'Customization Options',
    conditionalOn: 'customization_available',
    fieldTypes: ['text', 'select', 'color', 'file'] },
  { key: 'personalization_fields', type: 'list-builder', label: 'Personalization Fields',
    examples: ['Name to engrave', 'Custom message (max 50 chars)', 'Color preference'] },
  { key: 'is_limited_edition', type: 'boolean', label: 'Limited Edition?' },
  { key: 'edition_size', type: 'number', label: 'Total Edition Size',
    conditionalOn: 'is_limited_edition' },
  { key: 'edition_number', type: 'number', label: 'This Item\'s Number',
    conditionalOn: 'is_limited_edition' },
  { key: 'maker_notes', type: 'textarea', label: 'Maker Notes',
    placeholder: 'Share the story behind this piece...' },
  { key: 'care_instructions', type: 'textarea', label: 'Care Instructions' },
  { key: 'gift_wrapping', type: 'boolean', label: 'Gift Wrapping Available' },
  { key: 'gift_message', type: 'boolean', label: 'Gift Message Available' },
];
```

---

## Implementation Priority Matrix

### Phase 1: High Priority (Core Differentiators)

| Component | Vertical | Effort | Impact |
|-----------|----------|--------|--------|
| `SizeGuideSection` | Fashion | Medium | High |
| `SpecComparison` | Electronics | Medium | High |
| `NutritionFactsPanel` | Food | Medium | High |
| `AllergenBadges` | Food | Low | High |
| `IngredientBreakdown` | Health & Beauty | Low | High |
| `MakerStorySection` | Handmade | Low | High |
| `DimensionGuide` | Home Goods | Medium | High |

### Phase 2: Medium Priority (Enhanced Experience)

| Component | Vertical | Effort | Impact |
|-----------|----------|--------|--------|
| `BeforeAfterGallery` | Health & Beauty | Medium | Medium |
| `LookbookGallery` | Fashion | Medium | Medium |
| `RecipeGallery` | Food | Medium | Medium |
| `CraftingProcessGallery` | Handmade | Medium | Medium |
| `TechSpecsSection` | Electronics | Low | Medium |
| `WarrantyInfoCard` | Electronics | Low | Medium |
| `PersonalizationForm` | Handmade | Medium | High |

### Phase 3: Advanced Features (Premium/Future)

| Component | Vertical | Effort | Impact |
|-----------|----------|--------|--------|
| `VirtualTryOn` | Fashion | Very High | Very High |
| `ARRoomVisualizer` | Home Goods | Very High | Very High |
| `Product3DViewer` | Home, Electronics | High | High |
| `RoutineBuilder` | Health & Beauty | High | Medium |
| `SkinTypeQuiz` | Health & Beauty | High | Medium |
| `CompatibilityChecker` | Electronics | Medium | Medium |

---

## Database Schema Reference

### `vertical_features` Table
```sql
CREATE TABLE vertical_features (
    id UUID PRIMARY KEY,
    feature_key TEXT UNIQUE NOT NULL,
    feature_name TEXT NOT NULL,
    description TEXT,
    business_types TEXT[] NOT NULL,        -- ['fashion', 'health-beauty']
    feature_category TEXT NOT NULL,         -- 'storefront', 'product', 'checkout', 'inventory'
    feature_type TEXT DEFAULT 'optional',   -- 'core', 'optional', 'premium'
    default_enabled BOOLEAN DEFAULT false,
    config_schema JSONB,
    ui_component TEXT,                      -- React component name
    dependencies TEXT[],                    -- Other features this depends on
    is_active BOOLEAN DEFAULT true
);
```

### `merchants.enabled_features`
```json
{
  "size_guide": true,
  "ai_tryon": false,
  "color_variants": true,
  "material_info": true
}
```

### `merchants.feature_config`
```json
{
  "ai_tryon": {
    "provider": "reactive_reality",
    "quality": "high"
  },
  "size_guide": {
    "measurement_unit": "cm",
    "show_model_info": true
  }
}
```

---

## Research Sources

### Fashion
- [Shopify - AR in Fashion](https://www.shopify.com/blog/augmented-reality-fashion)
- [Sizebay - Virtual Try-On Technology](https://sizebay.com/en/blog/virtual-try-on-technology/)
- [3DLook - Virtual Clothing Try-On](https://3dlook.ai/content-hub/virtual-clothing-try-on/)

### Electronics
- [Smashing Magazine - Comparison Tables](https://www.smashingmagazine.com/2017/08/designing-perfect-feature-comparison-table/)
- [Toolbox POS - IMEI Software](https://www.toolboxpos.com/boost-efficiency-with-serial-number-imei-inventory-software-for-your-business/)
- [NetSuite - Serialized Tracking](https://www.netsuite.com/portal/resource/articles/inventory-management/serialized-tracking.shtml)

### Food & Beverage
- [FDA - Food Labeling Guide](https://www.fda.gov/files/food/published/Food-Labeling-Guide-(PDF).pdf)
- [PMC - Online Food Labeling Study](https://pmc.ncbi.nlm.nih.gov/articles/PMC11604316/)
- [NYU - Food Labeling Lacking Online](https://www.nyu.edu/about/news-publications/news/2022/january/food-labeling-is-lacking-in-online-grocery-retailers.html)

### Health & Beauty
- [SkinSort - Routine Builder](https://skinsort.com/routine)
- [INCIDecoder - Ingredient Analysis](https://incidecoder.com/)
- [Skin Type Solutions - Quiz System](https://skintypesolutions.com/blogs/skincare/skin-care-routine-quiz)

### Home Goods
- [Shopify - AR Furniture](https://www.shopify.com/blog/augmented-reality-furniture)
- [Zolak - 3D Visualization Platforms](https://zolak.tech/blog/best-3d-product-visualization-platforms-for-ecommerce)
- [Threekit - 3D in Furniture E-commerce](https://www.threekit.com/the-role-of-3d-and-augmented-reality-in-furniture-ecommerce)

### Handmade
- [Shipturtle - Handmade Marketplace Guide](https://www.shipturtle.com/blog/create-handmade-crafts-and-artisan-goods-marketplace)
- [Etsy Marketplace](https://www.etsy.com/)

---

## Next Steps

1. **Implement Phase 1 Puck components** starting with `SizeGuideSection` and `SpecComparison`
2. **Build dynamic product form** that loads fields based on merchant's business type
3. **Update `initial-template-generator.ts`** to use `defaultPuckConfig` from business types
4. **Create feature toggle UI** in merchant dashboard settings
5. **Build out product form field components** (size-chart-builder, spec-builder, nutrition-builder, etc.)

---

*This document should be updated as features are implemented and new research is gathered.*
