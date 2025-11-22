# Baci - AI E-commerce Builder
## Complete App Blueprint for AI Development

**Version:** 1.0 MVP  
**Date:** October 30, 2025  
**Platform:** Mobile-First (iOS + Android) with Web Storefronts  
**Target Market:** Nigerian Small Businesses & Social Sellers  
**Development Approach:** AI-Assisted Solo Founder Build

---

## 📱 PRODUCT VISION

**Tagline:** "Your business, live in 3 minutes"

**Problem:** Small businesses in Nigeria spend 10-15 hours/week on manual e-commerce tasks. 80% never launch because existing tools are too complex or expensive.

**Solution:** Baci is an AI-native mobile app that creates complete e-commerce websites in under 3 minutes through a simple 3-question onboarding process.

**Unique Value:** 
- ✨ AI extracts brand colors from existing logos
- 🎨 Pre-designed templates instantly branded with user's colors
- 🤖 Gemini AI generates compelling product descriptions
- 💳 Integrated Paystack payments for Nigerian market
- 📱 Mobile-first with offline capabilities

---

## 🎯 CORE USER JOURNEY

### The 3-Minute Store Creation Flow

```
User Opens App
    ↓
1. "What do you sell?" 
   → Select from 6 categories (Fashion, Food, Beauty, Crafts, Services, Other)
    ↓
2. "Do you have a business logo?"
   → YES: Upload logo → AI extracts 5 brand colors (Gemini Vision)
   → NO: Use curated default color palette for selected category
    ↓
3. "Choose your store style"
   → Shows 2 template previews with user's colors already applied
   → User selects preferred template
    ↓
✨ STORE CREATED (subdomain: {businessname}.baci.tech)
    ↓
Dashboard → Quick Actions:
   • Add Your First Product
   • Share Store Link
   • Connect Payment (Paystack)
```

### Product Creation Flow

```
Dashboard → Add Product
    ↓
Enter Required Info:
   • Product name
   • Price (₦)
   • Upload photo (camera or gallery)
    ↓
Optional AI Enhancement:
   • [Generate Description] → Gemini creates compelling copy
   • User can edit or regenerate
    ↓
Additional Details (optional):
   • Category
   • Stock quantity
   • Tags
    ↓
Save Product
    ↓
Product appears in catalog + live store
```

### Customer Purchase Flow

```
Customer visits: username.baci.tech
    ↓
Browses products (template-styled with merchant's colors)
    ↓
Adds to cart
    ↓
Checkout:
   • Name, phone, delivery address
   • Payment method (Card, Bank Transfer, USSD)
    ↓
Redirects to Paystack
    ↓
Payment successful
    ↓
Order confirmation (merchant notified)
```

---

## 🏗️ TECHNICAL ARCHITECTURE

### Technology Stack

```yaml
Mobile App (Merchant Dashboard):
  Framework: React Native 0.74
  Runtime: Expo SDK 51
  Language: TypeScript (strict mode)
  Routing: Expo Router (file-based)
  State Management: Zustand
  Data Fetching: TanStack Query v5
  Forms: React Hook Form + Zod validation
  Styling: NativeWind (Tailwind CSS for React Native)
  UI Components: React Native Paper (Material Design 3)
  Icons: @expo/vector-icons (Material Community Icons)

Web App (Customer Storefronts):
  Framework: Next.js 14 (App Router)
  Language: TypeScript
  Styling: Tailwind CSS
  Deployment: Vercel

Backend:
  Platform: Firebase (Google Cloud)
  Authentication: Firebase Auth
    - Email/Password
    - Phone (OTP)
  Database: Cloud Firestore (NoSQL)
  File Storage: Firebase Storage (with CDN)
  Serverless: Cloud Functions (Node.js 20, TypeScript)
  Hosting: Firebase Hosting (web) + Expo EAS (mobile)

AI Services:
  Provider: Google Gemini API
  Models:
    - gemini-2.0-flash: Text generation (descriptions)
    - gemini-2.0-flash-vision: Image analysis (color extraction)
  Integration: @google/generative-ai npm package
  Cost: ~$5.50/month per 1,000 users (MVP optimization)

Payment Processing:
  Provider: Paystack (Nigeria-focused)
  Integration: react-native-paystack-webview
  Methods: Cards, Bank Transfer, USSD, QR Code
  Test Mode: Sandbox for development
  Fees: 2.5% per transaction

Analytics:
  Firebase Analytics (user behavior)
  Google Analytics 4 (web traffic)

Development Tools:
  Version Control: Git + GitHub
  CI/CD: GitHub Actions
  Mobile Build: Expo EAS Build
  Package Manager: npm
  Code Editor: VS Code with extensions:
    - ESLint
    - Prettier
    - Tailwind CSS IntelliSense
    - Firebase
```

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    MOBILE APP (Merchant)                     │
│                   React Native + Expo                        │
│                                                               │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐        │
│  │ Onboarding  │  │   Product    │  │   Orders    │        │
│  │   Screens   │  │  Management  │  │ Management  │        │
│  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘        │
│         │                │                  │                │
└─────────┼────────────────┼──────────────────┼────────────────┘
          │                │                  │
          ▼                ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    FIREBASE BACKEND                          │
│                                                               │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Cloud     │  │  Firestore   │  │   Storage    │       │
│  │  Functions  │  │   Database   │  │   (Images)   │       │
│  └──────┬──────┘  └──────────────┘  └──────────────┘       │
│         │                                                     │
└─────────┼─────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                         │
│                                                               │
│  ┌──────────────────┐        ┌──────────────────┐          │
│  │   Gemini API     │        │    Paystack      │          │
│  │  (Color Extract, │        │   (Payments)     │          │
│  │  Descriptions)   │        │                  │          │
│  └──────────────────┘        └──────────────────┘          │
└─────────────────────────────────────────────────────────────┘
          │                            │
          ▼                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 WEB APP (Customer Stores)                    │
│                      Next.js 14                              │
│                                                               │
│  Dynamic Routes: [subdomain].baci.tech                     │
│  Templates: Render with merchant's brand colors             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 DATABASE SCHEMA (Firestore)

### Collections Structure

#### 1. `users/` Collection
```typescript
interface User {
  userId: string;              // Auto-generated by Firebase Auth
  email: string;
  phone: string;               // Format: +234XXXXXXXXXX
  displayName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  plan: 'free' | 'pro' | 'premium';
  
  subscription?: {
    status: 'active' | 'canceled' | 'expired';
    planId: string;
    startDate: Timestamp;
    endDate: Timestamp;
    paystackSubscriptionCode: string;
  };
}

// Example document path: users/abc123xyz
```

#### 2. `stores/` Collection
```typescript
interface Store {
  storeId: string;             // Auto-generated
  userId: string;              // Reference to owner
  
  // Business Info
  storeName: string;           // e.g., "Amara's Fashion"
  businessType: 'fashion' | 'food' | 'beauty' | 'crafts' | 'services' | 'other';
  tagline?: string;
  
  // Branding
  branding: {
    hasLogo: boolean;
    logoUrl?: string;          // Firebase Storage URL
    colors: {
      primary: string;         // Hex: #3F51B5
      secondary: string;       // Hex: #F5F5F5
      accent: string;          // Hex: #FFC107
      background: string;      // Hex: #FFFFFF
      text: string;            // Hex: #212121
    };
    colorSource: 'ai_extracted' | 'default_palette';
  };
  
  // Store Configuration
  template: 'modern_minimal' | 'bold_colorful';
  subdomain: string;           // e.g., "amaras-fashion" → amaras-fashion.baci.tech
  customDomain?: string;       // Premium feature: www.amarasfashion.com
  
  // Settings
  currency: 'NGN';             // Naira only for MVP
  
  // Status
  status: 'active' | 'paused' | 'suspended';
  isPaymentConnected: boolean;
  paystackSecretKey?: string;  // Encrypted
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastOrderAt?: Timestamp;
  
  // Stats (denormalized for performance)
  stats: {
    totalProducts: number;
    totalOrders: number;
    totalRevenue: number;      // In kobo (₦1 = 100 kobo)
    totalViews: number;
  };
}

// Example document path: stores/store123
// Security Rule: Only owner can read/write their store
```

#### 3. `products/` Collection
```typescript
interface Product {
  productId: string;           // Auto-generated
  storeId: string;             // Parent store reference
  
  // Basic Info
  name: string;
  description: string;
  descriptionSource: 'ai_generated' | 'manual' | 'edited_ai';
  
  // Pricing
  pricing: {
    amount: number;            // In kobo (₦15,000 = 1500000)
    currency: 'NGN';
    compareAtPrice?: number;   // For showing discounts
  };
  
  // Images
  images: Array<{
    id: string;
    originalUrl: string;       // Firebase Storage URL
    thumbnailUrl: string;      // Auto-generated 300x300
    order: number;             // Display order
  }>;
  
  // Inventory
  inventory: {
    trackQuantity: boolean;
    quantity: number;
    lowStockThreshold: number;
    sku?: string;
  };
  
  // Organization
  category?: string;
  tags: string[];
  
  // Status
  status: 'active' | 'draft' | 'archived';
  isVisible: boolean;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // Analytics (denormalized)
  views: number;
  orders: number;
}

// Example document path: products/prod456
// Firestore Index: [storeId, status, createdAt DESC]
```

#### 4. `orders/` Collection
```typescript
interface Order {
  orderId: string;             // Auto-generated
  orderNumber: string;         // Human-readable: #BAC-1001
  storeId: string;
  
  // Customer Info
  customer: {
    name: string;
    email: string;
    phone: string;
    address: {
      street: string;
      city: string;
      state: string;
      postalCode?: string;
      country: 'Nigeria';
    };
  };
  
  // Order Items
  items: Array<{
    productId: string;
    productName: string;        // Snapshot at order time
    productImage: string;
    quantity: number;
    unitPrice: number;          // In kobo
    subtotal: number;
  }>;
  
  // Totals
  totals: {
    subtotal: number;           // In kobo
    shipping: number;
    tax: number;
    discount: number;
    total: number;
  };
  
  // Payment
  payment: {
    method: 'card' | 'bank_transfer' | 'ussd' | 'qr';
    status: 'pending' | 'paid' | 'failed' | 'refunded';
    provider: 'paystack';
    reference: string;          // Paystack transaction reference
    paidAt?: Timestamp;
    amount: number;
  };
  
  // Fulfillment
  fulfillment: {
    status: 'unfulfilled' | 'processing' | 'shipped' | 'delivered' | 'canceled';
    trackingNumber?: string;
    carrier?: string;
    shippedAt?: Timestamp;
    deliveredAt?: Timestamp;
    notes?: string;
  };
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // Customer Notes
  customerNote?: string;
  merchantNote?: string;
}

// Example document path: orders/order789
// Firestore Index: [storeId, createdAt DESC]
// Firestore Index: [storeId, payment.status, createdAt DESC]
```

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper Functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    // Users Collection
    match /users/{userId} {
      allow read, write: if isOwner(userId);
    }
    
    // Stores Collection
    match /stores/{storeId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if isOwner(resource.data.userId);
    }
    
    // Products Collection
    match /products/{productId} {
      allow read: if true; // Public read for customer storefronts
      allow write: if isAuthenticated() 
                   && exists(/databases/$(database)/documents/stores/$(request.resource.data.storeId))
                   && get(/databases/$(database)/documents/stores/$(request.resource.data.storeId)).data.userId == request.auth.uid;
    }
    
    // Orders Collection
    match /orders/{orderId} {
      allow read: if isAuthenticated()
                  && exists(/databases/$(database)/documents/stores/$(resource.data.storeId))
                  && get(/databases/$(database)/documents/stores/$(resource.data.storeId)).data.userId == request.auth.uid;
      allow create: if true; // Allow customers to create orders
      allow update: if isAuthenticated()
                    && get(/databases/$(database)/documents/stores/$(resource.data.storeId)).data.userId == request.auth.uid;
    }
  }
}
```

---

## 🎨 DESIGN SYSTEM

### Color Palette

```typescript
// Primary Brand Colors (Baci App)
export const BaciColors = {
  primary: '#3F51B5',      // Deep Indigo - trust, security, professionalism
  secondary: '#F5F5F5',    // Light Gray - clean neutral backdrop
  accent: '#FFC107',       // Amber - visual interest, CTAs
  
  // Supporting Colors
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  info: '#2196F3',
  
  // Text Colors
  textPrimary: '#212121',
  textSecondary: '#757575',
  textDisabled: '#BDBDBD',
  
  // Background Colors
  background: '#FFFFFF',
  backgroundAlt: '#FAFAFA',
  
  // Border Colors
  border: '#E0E0E0',
  divider: '#EEEEEE',
};

// Default Color Palettes by Business Type
export const DefaultPalettes = {
  fashion: {
    primary: '#FF6B6B',
    secondary: '#4ECDC4',
    accent: '#FFE66D',
    background: '#FFFFFF',
    text: '#2C3E50',
  },
  food: {
    primary: '#FF8C42',
    secondary: '#FFA400',
    accent: '#FF5A5F',
    background: '#FFF8F0',
    text: '#2D3436',
  },
  beauty: {
    primary: '#E91E63',
    secondary: '#9C27B0',
    accent: '#FF4081',
    background: '#FFF5F8',
    text: '#1A1A2E',
  },
  crafts: {
    primary: '#8B4513',
    secondary: '#D2691E',
    accent: '#FFD700',
    background: '#FFF9F0',
    text: '#3E2723',
  },
  services: {
    primary: '#2196F3',
    secondary: '#03A9F4',
    accent: '#00BCD4',
    background: '#F5FCFF',
    text: '#263238',
  },
  other: {
    primary: '#607D8B',
    secondary: '#90A4AE',
    accent: '#FF5722',
    background: '#FAFAFA',
    text: '#37474F',
  },
};
```

### Typography

```typescript
// Font: Inter (sans-serif)
// Import from Google Fonts or expo-google-fonts

export const Typography = {
  // Headings
  h1: {
    fontFamily: 'Inter-Bold',
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
  },
  h2: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
  },
  h3: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
  },
  h4: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
  },
  
  // Body Text
  bodyLarge: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  body: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  bodySmall: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },
  
  // Special
  button: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  caption: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },
};
```

### Spacing & Layout

```typescript
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
};
```

### Component Patterns

```typescript
// Button Variants
export const ButtonStyles = {
  primary: {
    backgroundColor: BaciColors.primary,
    color: '#FFFFFF',
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: BaciColors.primary,
    color: BaciColors.primary,
  },
  accent: {
    backgroundColor: BaciColors.accent,
    color: BaciColors.textPrimary,
  },
};

// Card Component
export const CardStyles = {
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.md,
  },
};

// Input Component
export const InputStyles = {
  container: {
    borderWidth: 1,
    borderColor: BaciColors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    backgroundColor: '#FFFFFF',
  },
  focus: {
    borderColor: BaciColors.primary,
  },
  error: {
    borderColor: BaciColors.error,
  },
};
```

---

## 🤖 AI INTEGRATION SPECIFICATIONS

### 1. Color Extraction (Gemini Vision)

**Purpose:** Extract 5 brand colors from uploaded logo

**Implementation:** Cloud Function (server-side)

**API Details:**
- Model: `gemini-2.0-flash-vision-001`
- Cost: ~$0.001 per extraction
- Rate Limit: 60 requests/minute (free tier)

**Prompt Template:**
```
Analyze this logo image and extract the dominant brand colors.

Return EXACTLY 5 colors in this JSON format:
{
  "primary": "#HEX",
  "secondary": "#HEX",
  "accent": "#HEX",
  "background": "#HEX",
  "text": "#HEX"
}

Rules:
1. primary: The most dominant/prominent color in the logo
2. secondary: The second most visible color
3. accent: A vibrant color suitable for buttons and calls-to-action (should stand out)
4. background: A light, neutral color suitable for page backgrounds (white, light gray, cream)
5. text: A dark color suitable for readable body text (dark gray, black, navy)

If the logo doesn't have 5 distinct colors:
- Generate complementary colors that match the brand aesthetic
- Ensure good contrast between background and text (WCAG AA minimum)
- Make accent color vibrant enough for CTAs

Return ONLY valid JSON, no explanation, no markdown formatting.
```

**Error Handling:**
```typescript
// Retry logic
const maxRetries = 3;
for (let i = 0; i < maxRetries; i++) {
  try {
    const colors = await extractColorsFromGemini(imageBase64);
    return colors;
  } catch (error) {
    if (i === maxRetries - 1) {
      // Fallback to default palette
      return getDefaultPaletteForBusinessType(businessType);
    }
    await delay(Math.pow(2, i) * 1000); // Exponential backoff
  }
}
```

**Caching Strategy:**
```typescript
// Cache in Firestore to avoid redundant API calls
interface ColorExtractionCache {
  logoUrl: string;
  colors: BrandColors;
  extractedAt: Timestamp;
  expiresAt: Timestamp; // 30 days
}

// Before calling Gemini, check cache:
const cached = await db.collection('colorCache')
  .where('logoUrl', '==', logoUrl)
  .where('expiresAt', '>', new Date())
  .get();

if (!cached.empty) {
  return cached.docs[0].data().colors;
}
```

---

### 2. Product Description Generation (Gemini Flash)

**Purpose:** Generate compelling product descriptions

**Implementation:** Client-side (mobile app) for instant feedback

**API Details:**
- Model: `gemini-2.0-flash-001`
- Cost: ~$0.001 per description
- Rate Limit: 60 requests/minute

**Prompt Template:**
```
You are an expert e-commerce copywriter writing for a Nigerian online store.

PRODUCT INFORMATION:
- Name: {productName}
- Category: {category}
- Business Type: {businessType}

TASK:
Write a compelling 3-4 sentence product description.

STYLE GUIDE:
- Use conversational Nigerian English
- Be authentic and relatable (not overly formal)
- Focus on benefits and emotional transformation (not just features)
- Include specific use cases or occasions
- Create desire and urgency without being pushy
- Keep sentences short and mobile-friendly
- Address the customer directly using "you"

CATEGORY-SPECIFIC GUIDANCE:
- Fashion: Emphasize style, confidence, versatility, occasions (weddings, parties, work)
- Food: Emphasize taste, quality, freshness, authenticity, family/sharing moments
- Beauty: Emphasize results, self-care, confidence, natural ingredients
- Crafts: Emphasize uniqueness, craftsmanship, story, handmade quality

EXAMPLE (Fashion):
Input: "Ankara Maxi Dress"
Output: "Turn heads at every event in this stunning Ankara maxi dress. The vibrant African print and flowing silhouette flatter every body type, making you feel confident from morning to night. Perfect for weddings, church, or special occasions – pair with heels for elegance or sandals for a casual chic look. The premium fabric is comfortable, breathable, and easy to care for."

Now write for: {productName}
Return ONLY the description text. No labels, no formatting, no quotation marks.
```

**Usage Pattern:**
```typescript
// In mobile app (services/gemini.ts)
export async function generateProductDescription(
  productName: string,
  category: string,
  businessType: string
): Promise<string> {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = buildDescriptionPrompt(productName, category, businessType);
  
  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // Validate output
    if (text.length < 50 || text.length > 500) {
      throw new Error('Description length out of acceptable range');
    }
    
    return text.trim();
  } catch (error) {
    console.error('Failed to generate description:', error);
    throw error;
  }
}
```

**UI Pattern:**
```typescript
// Component usage
<View>
  <TextInput
    label="Product Name"
    value={productName}
    onChangeText={setProductName}
  />
  
  <TextInput
    label="Description"
    value={description}
    onChangeText={setDescription}
    multiline
    numberOfLines={4}
  />
  
  <Button
    mode="outlined"
    icon="auto-fix"
    onPress={handleGenerateDescription}
    loading={isGenerating}
  >
    Generate with AI
  </Button>
  
  {generatedDescription && (
    <View style={styles.previewCard}>
      <Text>{generatedDescription}</Text>
      <View style={styles.actions}>
        <Button onPress={() => setDescription(generatedDescription)}>
          Use This
        </Button>
        <Button onPress={handleGenerateDescription}>
          Regenerate
        </Button>
      </View>
    </View>
  )}
</View>
```

---

## 💳 PAYMENT INTEGRATION (Paystack)

### Setup

```bash
npm install react-native-paystack-webview
```

### Configuration

```typescript
// services/paystack.ts
import { Paystack } from 'react-native-paystack-webview';
import { PAYSTACK_PUBLIC_KEY } from '@env';

export interface PaymentParams {
  email: string;
  amount: number;        // In kobo (₦1 = 100 kobo)
  reference: string;     // Unique transaction reference
  metadata?: {
    orderId: string;
    customerId: string;
    storeId: string;
  };
}

export interface PaymentResponse {
  status: 'success' | 'failed';
  reference: string;
  transactionRef: string;
  message: string;
}
```

### Checkout Component

```typescript
// components/PaystackCheckout.tsx
import { Paystack, paystackProps } from 'react-native-paystack-webview';
import { useRef } from 'react';

interface CheckoutProps {
  email: string;
  amount: number;
  orderId: string;
  onSuccess: (response: PaymentResponse) => void;
  onCancel: () => void;
}

export function PaystackCheckout({
  email,
  amount,
  orderId,
  onSuccess,
  onCancel,
}: CheckoutProps) {
  const paystackRef = useRef<paystackProps.PayStackRef>(null);

  const handlePayment = () => {
    paystackRef.current?.startTransaction();
  };

  return (
    <>
      <Button onPress={handlePayment}>
        Pay ₦{(amount / 100).toLocaleString()}
      </Button>
      
      <Paystack
        ref={paystackRef}
        paystackKey={PAYSTACK_PUBLIC_KEY}
        amount={amount}
        billingEmail={email}
        activityIndicatorColor={BaciColors.primary}
        onCancel={onCancel}
        onSuccess={(response) => {
          onSuccess({
            status: 'success',
            reference: response.reference,
            transactionRef: response.transId,
            message: 'Payment successful',
          });
        }}
        autoStart={false}
      />
    </>
  );
}
```

### Webhook Handler (Cloud Function)

```typescript
// functions/src/payments/paystackWebhook.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import crypto from 'crypto';

export const paystackWebhook = functions.https.onRequest(async (req, res) => {
  // Verify webhook signature
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(401).send('Invalid signature');
  }

  const event = req.body;

  if (event.event === 'charge.success') {
    const { reference, amount, metadata } = event.data;
    const orderId = metadata.orderId;

    // Update order in Firestore
    await admin.firestore().collection('orders').doc(orderId).update({
      'payment.status': 'paid',
      'payment.reference': reference,
      'payment.paidAt': admin.firestore.FieldValue.serverTimestamp(),
    });

    // Send confirmation email/SMS (optional)
    // Trigger inventory deduction
    // Update store stats
  }

  res.status(200).send('OK');
});
```

---

## 📱 MOBILE APP STRUCTURE

### File Structure

```
baci-mobile/
├── app/                          # Expo Router pages
│   ├── (auth)/                   # Auth group
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── signup.tsx
│   │
│   ├── (onboarding)/             # Onboarding flow
│   │   ├── _layout.tsx
│   │   ├── index.tsx             # Business type selection
│   │   ├── logo.tsx              # Logo upload/skip
│   │   └── template.tsx          # Template selection
│   │
│   ├── (tabs)/                   # Main app (bottom tabs)
│   │   ├── _layout.tsx
│   │   ├── index.tsx             # Dashboard
│   │   ├── products.tsx          # Product list
│   │   ├── orders.tsx            # Order list
│   │   └── settings.tsx          # Store settings
│   │
│   ├── product/
│   │   ├── add.tsx               # Add new product
│   │   └── [id].tsx              # Edit product
│   │
│   └── _layout.tsx               # Root layout
│
├── components/                   # Reusable components
│   ├── ui/                       # Basic UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   └── Loading.tsx
│   │
│   ├── business/
│   │   ├── BusinessTypeCard.tsx
│   │   └── TemplatePreview.tsx
│   │
│   └── products/
│       ├── ProductCard.tsx
│       ├── ProductForm.tsx
│       └── AIDescriptionGenerator.tsx
│
├── services/                     # External integrations
│   ├── firebase.ts               # Firebase initialization
│   ├── auth.ts                   # Auth helpers
│   ├── firestore.ts              # Database operations
│   ├── storage.ts                # File uploads
│   ├── gemini.ts                 # AI operations
│   └── paystack.ts               # Payment processing
│
├── stores/                       # Zustand state stores
│   ├── authStore.ts
│   ├── onboardingStore.ts
│   ├── storeStore.ts
│   └── productsStore.ts
│
├── hooks/                        # Custom React hooks
│   ├── useAuth.ts
│   ├── useStore.ts
│   └── useProducts.ts
│
├── utils/                        # Helper functions
│   ├── constants.ts
│   ├── validators.ts
│   ├── formatters.ts
│   └── imageHelpers.ts
│
├── types/                        # TypeScript definitions
│   ├── store.ts
│   ├── product.ts
│   ├── order.ts
│   └── user.ts
│
├── assets/                       # Images, fonts, etc.
│   ├── images/
│   └── fonts/
│
├── app.json                      # Expo configuration
├── eas.json                      # EAS Build config
├── package.json
├── tsconfig.json
└── tailwind.config.js
```

---

## 🎨 TEMPLATE SYSTEM

### Template Architecture

Baci includes 2 pre-designed templates for MVP. Each template:
- Accepts merchant's brand colors as props
- Renders product catalog dynamically
- Provides responsive layouts
- Includes checkout flow

### Template 1: Modern Minimal

**Best For:** Fashion, Beauty, Professional Services

**Characteristics:**
- Clean, spacious layout
- Large product images
- Plenty of white space
- Subtle shadows and borders
- Modern sans-serif typography

**Color Usage:**
- Primary: Navigation bar, headings
- Secondary: Background alternating sections
- Accent: CTAs (Add to Cart, Buy Now)
- Background: Main page background
- Text: Body copy

**Layout:**
```
┌─────────────────────────────────────┐
│  [Logo]        [Store Name]    [🛒] │ ← Primary color
├─────────────────────────────────────┤
│                                     │
│         Featured Product            │ ← Hero section
│         [Large Image]               │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  [Product] [Product] [Product]     │ ← Grid layout
│  [Product] [Product] [Product]     │   2 columns mobile
│                                     │
└─────────────────────────────────────┘
```

### Template 2: Bold Colorful

**Best For:** Food, Crafts, Fun Brands

**Characteristics:**
- Vibrant color blocks
- Playful typography
- Rounded corners
- Eye-catching gradients
- Colorful category badges

**Color Usage:**
- Primary & Secondary: Gradient backgrounds
- Accent: Category badges, price tags
- Background: Card backgrounds
- Text: Overlays on colored backgrounds

**Layout:**
```
┌─────────────────────────────────────┐
│    [Logo] [Store Name]              │
│    ╔════════════════════╗           │ ← Gradient hero
│    ║  Welcome Message   ║           │   (Primary → Secondary)
│    ╚════════════════════╝           │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────┐  ┌─────────┐          │ ← Colored cards
│  │ Product │  │ Product │          │
│  │  [IMG]  │  │  [IMG]  │          │
│  └─────────┘  └─────────┘          │
│                                     │
└─────────────────────────────────────┘
```

---

## 🚀 DEVELOPMENT WORKFLOW

### Phase 1: Project Setup (Week 1)

**Day 1-2: Initialize Project**
```bash
# Create Expo app
npx create-expo-app baci-mobile --template expo-template-blank-typescript

cd baci-mobile

# Install core dependencies
npx expo install expo-router react-native-safe-area-context
npx expo install react-native-screens expo-linking expo-constants
npm install zustand @tanstack/react-query
npm install react-hook-form zod
npm install nativewind tailwindcss

# Install Firebase
npm install firebase
npm install @react-native-firebase/app @react-native-firebase/auth
npm install @react-native-firebase/firestore @react-native-firebase/storage

# Install AI & Payments
npm install @google/generative-ai
npm install react-native-paystack-webview

# Setup Tailwind
npx tailwindcss init
```

**Day 3-4: Firebase Configuration**
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login and initialize
firebase login
firebase init

# Select services:
# ✓ Firestore
# ✓ Functions
# ✓ Storage
# ✓ Hosting

# Create environment config
```

**Day 5-7: Project Structure**
- Create folder structure
- Setup navigation with Expo Router
- Configure NativeWind
- Setup Zustand stores
- Create basic UI components

---

### Phase 2: Authentication (Week 2)

**Day 1-3: Auth Screens**
- Login screen with email/password
- Signup screen
- Phone verification (Firebase Phone Auth)
- Forgot password flow

**Day 4-5: Auth Logic**
- Firebase Auth integration
- Auth state management (Zustand)
- Protected routes
- Persist auth state

**Day 6-7: Testing**
- Test all auth flows
- Error handling
- Loading states

---

### Phase 3: Onboarding Flow (Week 3-4)

**Week 3:**
- Business type selection screen
- Logo upload screen with image picker
- Default color palette system
- Color extraction Cloud Function

**Week 4:**
- Template selection screen
- Template preview with applied colors
- Store creation logic
- Subdomain generation

---

### Phase 4: Product Management (Week 5-6)

**Week 5:**
- Product list screen
- Add product form
- Image upload to Firebase Storage
- Form validation with Zod

**Week 6:**
- AI description generation integration
- Edit product screen
- Delete product functionality
- Product search and filters

---

### Phase 5: Orders & Payments (Week 7-8)

**Week 7:**
- Paystack integration
- Checkout flow
- Payment webhook Cloud Function
- Order creation

**Week 8:**
- Orders list screen
- Order details screen
- Order status updates
- Testing payments (sandbox)

---

### Phase 6: Dashboard & Polish (Week 9-10)

**Week 9:**
- Dashboard with metrics
- Store settings screen
- Share store functionality
- Profile management

**Week 10:**
- Bug fixes
- Performance optimization
- UI polish
- Beta testing with 10 users

---

## 🧪 TESTING STRATEGY

### Unit Testing
```bash
npm install --save-dev jest @testing-library/react-native
```

**Test Coverage Goals:**
- Services: 80%+
- Utilities: 90%+
- Components: 60%+

**Example Test:**
```typescript
// __tests__/services/gemini.test.ts
import { generateProductDescription } from '@/services/gemini';

describe('Gemini Service', () => {
  it('generates product description', async () => {
    const description = await generateProductDescription(
      'Ankara Dress',
      'fashion',
      'fashion'
    );
    
    expect(description).toBeDefined();
    expect(description.length).toBeGreaterThan(50);
    expect(description.length).toBeLessThan(500);
  });
  
  it('handles API errors gracefully', async () => {
    // Mock API failure
    await expect(
      generateProductDescription('', '', '')
    ).rejects.toThrow();
  });
});
```

### Integration Testing
- Test Firebase operations with emulator
- Test Gemini API with test credentials
- Test Paystack with sandbox mode

### E2E Testing
```bash
npm install --save-dev detox
```

**Critical Flows to Test:**
1. Complete onboarding (3 questions)
2. Add product with AI description
3. Complete checkout with Paystack
4. View order in dashboard

---

## 📊 ANALYTICS & MONITORING

### Firebase Analytics Events

```typescript
// Track key user actions
export const AnalyticsEvents = {
  // Onboarding
  ONBOARDING_STARTED: 'onboarding_started',
  BUSINESS_TYPE_SELECTED: 'business_type_selected',
  LOGO_UPLOADED: 'logo_uploaded',
  COLORS_EXTRACTED: 'colors_extracted',
  TEMPLATE_SELECTED: 'template_selected',
  STORE_CREATED: 'store_created',
  
  // Products
  PRODUCT_ADDED: 'product_added',
  AI_DESCRIPTION_GENERATED: 'ai_description_generated',
  AI_DESCRIPTION_USED: 'ai_description_used',
  PRODUCT_PUBLISHED: 'product_published',
  
  // Orders
  ORDER_PLACED: 'order_placed',
  PAYMENT_INITIATED: 'payment_initiated',
  PAYMENT_COMPLETED: 'payment_completed',
  PAYMENT_FAILED: 'payment_failed',
  
  // Engagement
  STORE_SHARED: 'store_shared',
  STORE_VIEWED: 'store_viewed',
  PRODUCT_VIEWED: 'product_viewed',
};

// Usage
import analytics from '@react-native-firebase/analytics';

await analytics().logEvent(AnalyticsEvents.STORE_CREATED, {
  business_type: 'fashion',
  has_logo: true,
  template: 'modern_minimal',
});
```

### Performance Monitoring

```typescript
// Track app performance
import perf from '@react-native-firebase/perf';

// Trace custom operations
const trace = await perf().startTrace('ai_description_generation');
try {
  const description = await generateProductDescription(...);
  trace.putMetric('success', 1);
} catch (error) {
  trace.putMetric('failure', 1);
} finally {
  await trace.stop();
}
```

---

## 💰 COST PROJECTIONS

### Monthly Operating Costs (1,000 Active Users)

```
Infrastructure:
├── Firebase (Blaze Plan)
│   ├── Firestore (reads/writes)        $25
│   ├── Storage (10GB + bandwidth)      $15
│   ├── Cloud Functions (invocations)   $10
│   └── Hosting                         $5
│   Subtotal:                           $55

AI Services:
├── Gemini API
│   ├── Color extraction (1,000 users)  $1
│   ├── Descriptions (5,000 products)   $5
│   Subtotal:                           $6

Payments:
├── Paystack (transaction fees)
│   └── 2.5% per transaction            [Pass to customer]

Third-Party:
├── Expo EAS Build                      $0 (free tier)
├── Vercel (web hosting)                $20
│   Subtotal:                           $20

TOTAL MONTHLY COST:                     $81
Per-User Cost:                          $0.08
```

### Revenue Model

```
Free Tier (70% of users):
├── 1 store
├── 10 products max
├── 5 AI descriptions/month
├── Subdomain only
└── Revenue: ₦0

Pro Tier (25% of users):
├── Unlimited products
├── 50 AI descriptions/month
├── Advanced analytics
├── Priority support
└── Revenue: ₦5,000/month (~$5 USD)

Premium Tier (5% of users):
├── Everything in Pro
├── Custom domain
├── Unlimited AI generations
├── Multi-user accounts
└── Revenue: ₦15,000/month (~$15 USD)

Projected Revenue (1,000 users):
├── Free: 700 × ₦0 = ₦0
├── Pro: 250 × ₦5,000 = ₦1,250,000
└── Premium: 50 × ₦15,000 = ₦750,000
    Total: ₦2,000,000/month (~$2,000 USD)

Profit Margin:
Revenue: $2,000
Costs: $81
Profit: $1,919 (95.9% margin)
```

---

## 🎯 SUCCESS METRICS

### Key Performance Indicators (KPIs)

**North Star Metric:**
- Monthly Gross Merchandise Value (GMV) per Active Store

**Onboarding Funnel:**
```
Landing Page Visit: 100%
  ↓ (40% conversion)
Signup: 40%
  ↓ (70% conversion)
Complete Onboarding: 28%
  ↓ (60% conversion)
Add First Product: 17%
  ↓ (30% conversion)
First Sale: 5%
```

**Targets (Month 3):**
- Total Signups: 1,000
- Active Stores (≥1 product): 300
- Stores with Sales: 50
- Average GMV/Store: ₦50,000/month
- Total Platform GMV: ₦2,500,000/month

**Engagement Metrics:**
- Daily Active Users: 20%
- Weekly Active Users: 45%
- Monthly Active Users: 70%
- Average Session Duration: 8 minutes
- Products per Store: 12 (average)

**AI Usage:**
- % of products with AI descriptions: 70%
- AI description acceptance rate: 65%
- Average regenerations per product: 1.3

**Payment Metrics:**
- Payment completion rate: 85%
- Average order value: ₦8,000
- Orders per active store/month: 6

---

## 🔒 SECURITY CONSIDERATIONS

### API Key Management

```typescript
// NEVER hardcode API keys
// Use environment variables

// .env (NOT committed to git)
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_GEMINI_API_KEY=...
EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY=...

// .env.local (for Cloud Functions)
PAYSTACK_SECRET_KEY=...
GEMINI_API_KEY=...

// Access in code:
import Constants from 'expo-constants';
const apiKey = Constants.expoConfig?.extra?.firebaseApiKey;
```

### Firestore Security

```javascript
// CRITICAL: Validate all writes
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Never allow unrestricted access
    match /{document=**} {
      allow read, write: if false;
    }
    
    // Explicit rules for each collection
    match /stores/{storeId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null 
                    && request.resource.data.userId == request.auth.uid;
      allow update, delete: if resource.data.userId == request.auth.uid;
    }
  }
}
```

### Payment Security

```typescript
// NEVER store credit card details
// Use Paystack's secure checkout

// ✅ CORRECT: Let Paystack handle payment
const paystackCheckout = (
  <Paystack
    paystackKey={PUBLIC_KEY}
    amount={amount}
    email={email}
    // Paystack securely handles payment
  />
);

// ❌ WRONG: Never collect card details yourself
const cardForm = (
  <View>
    <Input placeholder="Card Number" /> {/* NEVER DO THIS */}
    <Input placeholder="CVV" />
  </View>
);
```

### Image Upload Validation

```typescript
// Validate image uploads (Cloud Function)
export const validateImage = functions.storage
  .object()
  .onFinalize(async (object) => {
    const filePath = object.name;
    
    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (object.size > maxSize) {
      await storage.bucket().file(filePath).delete();
      throw new Error('File too large');
    }
    
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png'];
    if (!allowedTypes.includes(object.contentType!)) {
      await storage.bucket().file(filePath).delete();
      throw new Error('Invalid file type');
    }
  });
```

---

## 🚦 RATE LIMITING

### Gemini API Rate Limits

```typescript
// Implement request queue for Gemini API
import PQueue from 'p-queue';

const geminiQueue = new PQueue({
  concurrency: 1,              // One request at a time
  interval: 1000,              // Per second
  intervalCap: 1,              // Max 1 request per interval
});

// Usage
export async function generateProductDescription(
  productName: string,
  category: string
): Promise<string> {
  return geminiQueue.add(async () => {
    // Make Gemini API call
    return await callGeminiAPI(productName, category);
  });
}
```

### Firestore Rate Limiting

```typescript
// Prevent abuse with Firestore counters
interface RateLimit {
  userId: string;
  action: string;           // 'ai_description', 'product_create', etc.
  count: number;
  resetAt: Timestamp;
}

async function checkRateLimit(
  userId: string,
  action: string,
  limit: number
): Promise<boolean> {
  const rateLimitDoc = await db
    .collection('rateLimits')
    .doc(`${userId}_${action}`)
    .get();
    
  if (!rateLimitDoc.exists) {
    // Create new rate limit doc
    await rateLimitDoc.ref.set({
      userId,
      action,
      count: 1,
      resetAt: new Date(Date.now() + 86400000), // 24 hours
    });
    return true;
  }
  
  const data = rateLimitDoc.data() as RateLimit;
  
  // Reset if expired
  if (data.resetAt.toDate() < new Date()) {
    await rateLimitDoc.ref.update({
      count: 1,
      resetAt: new Date(Date.now() + 86400000),
    });
    return true;
  }
  
  // Check limit
  if (data.count >= limit) {
    return false; // Rate limit exceeded
  }
  
  // Increment counter
  await rateLimitDoc.ref.update({
    count: admin.firestore.FieldValue.increment(1),
  });
  
  return true;
}
```

---

## 📚 ADDITIONAL RESOURCES

### Documentation Links

- **React Native:** https://reactnative.dev/docs/getting-started
- **Expo:** https://docs.expo.dev/
- **Firebase:** https://firebase.google.com/docs
- **Gemini API:** https://ai.google.dev/docs
- **Paystack:** https://paystack.com/docs/api/
- **NativeWind:** https://www.nativewind.dev/

### Recommended Learning Path

1. **React Native Basics** (if new): 2-3 days
2. **Expo Router**: 1 day
3. **Firebase Integration**: 2-3 days
4. **Gemini API**: 1 day
5. **Paystack Integration**: 1 day

### Community Support

- **Expo Discord:** https://chat.expo.dev/
- **React Native Community:** r/reactnative
- **Firebase Community:** https://firebase.google.com/community

---

## 🎓 DEVELOPMENT BEST PRACTICES

### Code Quality

```typescript
// ✅ GOOD: Type-safe, clear, error handling
export async function createProduct(
  storeId: string,
  productData: CreateProductInput
): Promise<Product> {
  try {
    // Validate input
    const validatedData = productSchema.parse(productData);
    
    // Create in Firestore
    const docRef = await db.collection('products').add({
      ...validatedData,
      storeId,
      createdAt: FieldValue.serverTimestamp(),
    });
    
    return { id: docRef.id, ...validatedData };
  } catch (error) {
    console.error('Failed to create product:', error);
    throw new Error('Product creation failed');
  }
}

// ❌ BAD: No types, no validation, silent failures
export async function createProduct(storeId, data) {
  const doc = await db.collection('products').add(data);
  return doc;
}
```

### Component Structure

```typescript
// ✅ GOOD: Small, focused, reusable
interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={cn(
        'px-6 py-3 rounded-lg',
        variant === 'primary' && 'bg-indigo-600',
        variant === 'secondary' && 'bg-gray-200',
        disabled && 'opacity-50'
      )}
    >
      <Text className="text-white font-medium">{label}</Text>
    </Pressable>
  );
}

// ❌ BAD: Too many responsibilities
export function ProductScreen() {
  // 500 lines of mixed UI, logic, and API calls
}
```

### State Management

```typescript
// ✅ GOOD: Zustand store (simple, performant)
interface StoreState {
  store: Store | null;
  loading: boolean;
  error: string | null;
  
  fetchStore: (storeId: string) => Promise<void>;
  updateStore: (updates: Partial<Store>) => Promise<void>;
}

export const useStoreStore = create<StoreState>((set, get) => ({
  store: null,
  loading: false,
  error: null,
  
  fetchStore: async (storeId) => {
    set({ loading: true, error: null });
    try {
      const doc = await db.collection('stores').doc(storeId).get();
      set({ store: doc.data() as Store, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },
  
  updateStore: async (updates) => {
    const { store } = get();
    if (!store) return;
    
    await db.collection('stores').doc(store.storeId).update(updates);
    set({ store: { ...store, ...updates } });
  },
}));
```

---

## 🔄 CONTINUOUS DEPLOYMENT

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy Baci

on:
  push:
    branches: [main]

jobs:
  deploy-functions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install Firebase CLI
        run: npm install -g firebase-tools
      
      - name: Deploy Functions
        run: firebase deploy --only functions
        env:
          FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}

  deploy-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      
      - name: Deploy to Vercel
        run: vercel --prod
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
```

### EAS Build Configuration

```json
// eas.json
{
  "cli": {
    "version": ">= 5.9.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./service-account.json",
        "track": "internal"
      },
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "1234567890",
        "appleTeamId": "ABCD1234"
      }
    }
  }
}
```

---

## 📱 FINAL CHECKLIST

### Pre-Launch Checklist

**Technical:**
- [ ] All API keys in environment variables
- [ ] Firestore security rules deployed
- [ ] Firebase Storage rules configured
- [ ] Cloud Functions deployed and tested
- [ ] Paystack webhook verified
- [ ] Error tracking setup (Sentry/Firebase Crashlytics)
- [ ] Analytics events firing correctly
- [ ] App tested on iOS (iPhone 11+)
- [ ] App tested on Android (Android 8+)
- [ ] App tested on slow network (3G)

**Content:**
- [ ] App Store listing prepared
- [ ] Play Store listing prepared
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] Support email setup

**Business:**
- [ ] Paystack account verified (live mode)
- [ ] Bank account connected
- [ ] Pricing tiers finalized
- [ ] Beta testers feedback incorporated

**Marketing:**
- [ ] Landing page live
- [ ] Social media accounts created
- [ ] Launch announcement prepared
- [ ] Product Hunt listing ready

---

## 🎯 NEXT STEPS

### Immediate Actions (This Week)

1. **Setup Development Environment**
   ```bash
   # Install prerequisites
   brew install node watchman
   npm install -g expo-cli eas-cli firebase-tools
   
   # Create project
   npx create-expo-app baci-mobile --template expo-template-blank-typescript
   ```

2. **Create Firebase Project**
   - Go to https://console.firebase.google.com/
   - Create new project: "baci-production"
   - Enable Authentication, Firestore, Storage, Functions
   - Get configuration keys

3. **Get API Keys**
   - Gemini API: https://ai.google.dev/
   - Paystack: https://dashboard.paystack.com/ (sandbox first)

4. **Start Building**
   - Follow Phase 1 (Project Setup) above
   - Build authentication screens first
   - Then onboarding flow
   - Then product management

### Getting Help

If you encounter issues:
1. Check Expo documentation first
2. Search GitHub issues for similar problems
3. Ask in Expo Discord (very responsive)
4. Firebase support (if Firebase-specific)

---

## 📄 LICENSE & CREDITS

**Project:** Baci - AI E-commerce Builder  
**Created:** October 2025  
**Architecture:** React Native + Firebase + Gemini  
**Target Market:** Nigerian Small Businesses  

**Technology Credits:**
- React Native & Expo (Meta/Expo team)
- Firebase (Google)
- Gemini AI (Google)
- Paystack (Paystack HQ)
- NativeWind (Mark Lawlor)

---

**END OF BLUEPRINT**

This blueprint is designed to be comprehensive enough for AI-assisted development while remaining practical for a solo founder. All technical decisions are justified with Nigerian market context in mind.

For questions or clarifications, refer to the documentation links provided or consult the Expo/Firebase communities.

Good luck building Baci! 🚀