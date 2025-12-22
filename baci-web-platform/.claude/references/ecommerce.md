# E-commerce SEO Specifics

Tailored implementation for e-commerce sites, including platform builders and storefronts.

## Table of Contents
1. [E-commerce Topical Map Structure](#e-commerce-topical-map-structure)
2. [Product Page Optimization](#product-page-optimization)
3. [Category Strategy](#category-strategy)
4. [E-commerce Entity Modeling](#e-commerce-entity-modeling)
5. [Nigerian Market Specifics](#nigerian-market-specifics)
6. [Platform Builder vs Storefront](#platform-builder-vs-storefront)

## E-commerce Topical Map Structure

### For E-commerce Storefront (ogabassey.com):

**Central Entity:** Consumer Electronics Retail

**Source Context:** Trusted Nigerian gadget retailer with flexible payment (BNPL), local expertise, and reliable delivery

**Core Section (70%):**
```
Products
├── Smartphones
│   ├── Samsung
│   │   ├── Galaxy A series (A35, A55, A15)
│   │   ├── Galaxy S series
│   │   └── [Product pages with full EAV]
│   ├── Apple
│   │   └── iPhone models
│   ├── Xiaomi
│   └── Comparisons (brand vs brand, model vs model)
├── Laptops
├── Tablets
├── Accessories
│   ├── Phone cases
│   ├── Chargers
│   └── Screen protectors
├── Pricing/Deals
└── BNPL/Payment Options
```

**Outer Section (30%):**
```
Supporting Content
├── Buying Guides
│   ├── "Best Phones Under 100k"
│   ├── "Phone Buying Guide Nigeria"
│   └── "How to Choose..."
├── Tech Education
│   ├── Phone specifications explained
│   ├── Care and maintenance
│   └── Troubleshooting guides
├── Nigerian Tech Market
│   ├── Payment options in Nigeria
│   ├── Delivery and logistics
│   └── Warranty and support
└── News/Updates
    ├── New releases
    └── Price updates
```

### For E-commerce Platform (usebaci.com):

**Central Entity:** E-commerce Platform

**Source Context:** E-commerce platform built for African merchants, enabling online store creation with local payment and delivery integrations

**Core Section (70%):**
```
Platform Features
├── Store Building
│   ├── Templates/Themes
│   ├── Customization
│   └── Domain setup
├── Payments
│   ├── Paystack integration
│   ├── Flutterwave integration
│   └── Bank transfer
├── Shipping/Delivery
│   ├── Local delivery
│   ├── Shipping integrations
│   └── Pickup options
├── Inventory Management
├── Pricing/Plans
├── Comparisons
│   ├── vs Shopify
│   ├── vs WooCommerce
│   └── vs local alternatives
└── Use Cases
    ├── Small business
    ├── Fashion stores
    └── Food delivery
```

**Outer Section (30%):**
```
Supporting Content
├── Merchant Education
│   ├── Starting online business
│   ├── E-commerce marketing
│   └── Growing sales
├── Success Stories
├── Nigerian E-commerce
│   ├── Market trends
│   ├── Regulations
│   └── Consumer behavior
└── Integration Guides
```

## Product Page Optimization

### Required Elements:

**Above the Fold:**
- [ ] Product name (H1) with key identifier
- [ ] Primary product image
- [ ] Price (with Naira symbol: ₦)
- [ ] BNPL option if available ("₦25,000/month × 10")
- [ ] Add to Cart / Buy Now CTA
- [ ] Availability status
- [ ] Key specs (3-5 most important)

**Below the Fold:**
- [ ] Full specifications table (EAV format)
- [ ] Product description (unique, not manufacturer copy)
- [ ] Multiple product images
- [ ] Customer reviews
- [ ] Q&A section
- [ ] Related products
- [ ] Comparison links

### EAV Structure for Products:

```
Entity: Samsung Galaxy A35
├── Price: ₦250,000
├── Display: 6.6" Super AMOLED, 120Hz
├── Battery: 5000mAh, 25W charging
├── Camera: 50MP main, 12MP ultrawide, 5MP macro
├── Storage: 128GB (256GB available)
├── RAM: 6GB
├── Processor: Exynos 1380
├── OS: Android 14, One UI 6.0
├── Connectivity: 5G, Dual SIM
├── Availability: In Stock
├── Warranty: 12 months
├── Delivery: Lagos 1-2 days, Others 3-5 days
├── Payment Options: Full payment, Installment (Zilla)
└── What's in Box: Phone, charger, cable, documentation
```

### Product Schema:

```json
{
  "@type": "Product",
  "name": "Samsung Galaxy A35",
  "description": "Samsung Galaxy A35 smartphone with 6.6\" display...",
  "image": ["image1.jpg", "image2.jpg"],
  "brand": {"@type": "Brand", "name": "Samsung"},
  "sku": "SAMSUNG-A35-128",
  "offers": {
    "@type": "Offer",
    "price": "250000",
    "priceCurrency": "NGN",
    "availability": "https://schema.org/InStock",
    "seller": {"@type": "Organization", "name": "OgaBassey"}
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.5",
    "reviewCount": "47"
  }
}
```

## Category Strategy

### Category Page Content:

Categories are NOT just product listings. Add:

1. **Category Introduction (100-200 words)**
   - What products are in this category
   - Why buy from this category
   - What to consider when buying

2. **Key Filters/Attributes**
   - Price ranges
   - Brands
   - Key features

3. **Featured Products**
   - Top sellers
   - Best value
   - New arrivals

4. **Buying Guide Link**
   - Link to comprehensive guide
   - "How to choose the right [category]"

5. **FAQ Section**
   - Common questions about category
   - Shipping/payment questions

### Category Hierarchy:

```
/smartphones/                     (Main category)
  ├── /smartphones/samsung/       (Brand)
  │     └── /smartphones/samsung/a-series/  (Product line)
  ├── /smartphones/apple/
  ├── /smartphones/under-100000/  (Price-based)
  └── /smartphones/best-camera/   (Feature-based)
```

### Faceted Navigation:

- Canonical main category page for filtered URLs
- Only create static pages for high-value filters:
  - Brand filters (if >100 searches/month)
  - Price range filters (if distinct intent)
  - Key feature filters
- Block/noindex low-value filter combinations

## E-commerce Entity Modeling

### Product Entities:

```
Product: [Name]
├── Core Attributes (always include)
│   ├── Price
│   ├── Availability
│   ├── Brand
│   ├── Model/SKU
│   └── Primary category
├── Specification Attributes (category-specific)
│   ├── [Spec 1]
│   ├── [Spec 2]
│   └── ...
├── Purchase Attributes
│   ├── Payment options
│   ├── Delivery info
│   └── Warranty
├── Comparison Attributes
│   ├── vs [Competitor 1]
│   └── vs [Predecessor]
└── Social Proof
    ├── Reviews
    ├── Ratings
    └── Q&A
```

### Brand Entities:

```
Brand: Samsung
├── Description
├── Product lines (Galaxy A, S, Z)
├── Price ranges
├── Unique value props
├── Warranty/support info
└── Related brands (competitors)
```

### Category Entities:

```
Category: Smartphones
├── Definition
├── Key considerations when buying
├── Price ranges
├── Top brands
├── Popular features
└── Subcategories
```

## Nigerian Market Specifics

### Payment Options Content:

Create dedicated content for:
- [ ] "Buy Now Pay Later" / Installment payments
- [ ] Bank transfer process
- [ ] USSD payment (if available)
- [ ] Payment on delivery / COD

**BNPL Entity Coverage:**
```
Entity: Buy Now Pay Later
├── What is BNPL
├── Available providers (Zilla, etc.)
├── How it works
├── Eligibility
├── Interest/fees
├── Which products qualify
└── How to apply
```

### Delivery Content:

- [ ] Lagos same-day/next-day delivery
- [ ] Nationwide delivery timelines
- [ ] Pickup locations
- [ ] Delivery tracking
- [ ] Delivery costs by region

### Trust Signals (Nigerian-specific):

- [ ] Physical store address (25 Montgomery Road, Yaba)
- [ ] Phone number (WhatsApp enabled)
- [ ] Instagram/social presence
- [ ] Customer reviews (Nigerian customers)
- [ ] Warranty handling process
- [ ] Return/exchange policy

### Local SEO:

```json
{
  "@type": "Store",
  "name": "OgaBassey Gadgets Store",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "25 Montgomery Road",
    "addressLocality": "Yaba",
    "addressRegion": "Lagos",
    "postalCode": "100001",
    "addressCountry": "NG"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "6.5xxx",
    "longitude": "3.3xxx"
  },
  "telephone": "+234...",
  "openingHours": "Mo-Sa 09:00-18:00"
}
```

### Language Considerations:

- Primary: Standard Nigerian English
- Include Nigerian Pidgin in informal content (where appropriate)
- Use local terminology:
  - "Naira" / "₦" not "NGN"
  - "BNPL" / "Installment" / "Pay small small"
  - "Tokunbo" if selling used items

## Platform Builder vs Storefront

### Key Differences:

| Aspect | Storefront (ogabassey) | Platform (usebaci) |
|--------|----------------------|-------------------|
| Central Entity | Products/Retail | Software/Platform |
| Primary Intent | Transactional | Commercial → Transactional |
| Content Type | Products + Guides | Features + Education |
| Trust Signals | Reviews, Stock, Delivery | Case Studies, Integrations |
| Conversion Goal | Purchase | Sign Up / Trial |
| Schema Focus | Product, LocalBusiness | SoftwareApplication, Organization |

### Platform-Specific Content:

**usebaci Core Content:**
1. Feature pages (one per major feature)
2. Integration pages (payment, shipping, etc.)
3. Pricing page (clear, comparable plans)
4. Use case pages (by industry/business type)
5. Comparison pages (vs competitors)
6. Documentation/Help center

**usebaci Quality Nodes:**
- "Complete Guide to Starting an Online Store in Nigeria"
- "E-commerce Payment Processing in Africa"
- "How to Choose the Right E-commerce Platform"

**usebaci Trust Signals:**
- Active merchant count
- Transaction volume processed
- Integration partnerships
- Customer testimonials/case studies
- Uptime/reliability stats

### Platform Schema:

```json
{
  "@type": "SoftwareApplication",
  "name": "Baci",
  "applicationCategory": "E-commerce Platform",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "NGN",
    "description": "Free plan available"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "ratingCount": "150"
  }
}
```
