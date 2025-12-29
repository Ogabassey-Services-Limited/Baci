# Gemini AI Assistant Context File

**Project:** Baci AI E-commerce Builder
**Last Updated:** 2025-12-29

This document provides essential context for AI assistants working on this codebase. Please review it carefully before making any changes.

---

## 🚨 Critical Rules - READ THIS FIRST

1.  **Monorepo Structure & Paths:**
    *   This is a Monorepo. Always verify you are in the correct application directory.
    *   **Web Builder:** `apps/web/` (Next.js 15, App Router).
    *   **Mobile Storefront:** `baci-mobile-storefront/` (Expo, React Native).
    *   **Shared Logic:** Supabase Edge Functions and common packages.

2.  **Business Types are Configuration-Driven:**
    *   **Single Source of Truth:** `apps/web/src/config/business-types.ts`.
    *   **NEVER** hardcode business types in components or AI flows. Import from the config file.
    *   To add or modify business types, edit this file. The UI and AI prompts will update automatically.

3.  **AI Flow Signatures are Strict:**
    *   AI flows are located in `apps/web/src/ai/flows/`.
    *   Input and output schemas are defined with Zod.
    *   **NEVER** modify a flow's signature without updating all calling components. Use `grep` to find all usages before changing schemas.

4.  **Theming is CSS Variable-Based:**
    *   Merchant brand colors are applied via CSS variables (e.g., `var(--store-primary)`).
    *   Color definitions are in `apps/web/src/app/globals.css`.
    *   Use themed components from `apps/web/src/components/themed/`.
    *   **DO NOT** hardcode colors.

5.  **"Shared Brain" Architecture:**
    *   Business logic (VAT, Delivery, Commissions) is shared between Web and Mobile via Supabase Edge Functions (e.g., `calculate-commerce`).
    *   **DO NOT** duplicate complex logic in the client; use the shared edge functions.

---

## 🚀 Project Overview

Baci is an AI-powered platform that enables merchants to build and launch e-commerce stores in minutes. The platform generates a branded web storefront and a native mobile app from a single configuration.

### Monorepo Structure

| Directory | Purpose | Tech Stack |
| :--- | :--- | :--- |
| **`apps/web/`** | The core "Builder" platform & Web Storefronts. | Next.js 15, React 19, Tailwind |
| **`baci-mobile-storefront/`** | The template for Merchant Mobile Apps. | Expo, React Native, NativeWind |
| **`docs/`** | Project documentation. | Markdown |

### Technology Stack

| Category | Technology | Why |
| :--- | :--- | :--- |
| **Framework** | Next.js 15 (Web) / Expo (Mobile) | Performance & Native capabilities. |
| **Backend** | Supabase | Auth, Database, Storage, Edge Functions. |
| **AI** | Google Genkit + Gemini Models | Robust, production-ready AI flows. |
| **State** | TanStack Query + Zustand | Server state syncing & global client state. |
| **Styling** | Tailwind CSS + shadcn/ui | Unified design system across web & mobile. |

---

## 📁 Key File Locations

| Path | Purpose |
| :--- | :--- |
| `apps/web/src/config/business-types.ts` | **Source of Truth** for business categories & AI prompts. |
| `apps/web/src/ai/flows/` | Directory containing all Genkit AI flows. |
| `apps/web/src/app/onboarding/` | The main AI-driven onboarding wizard. |
| `apps/web/src/components/themed/` | Brand-aware component library. |
| `baci-mobile-storefront/app.json` | Mobile app configuration & deep linking setup. |
| `baci-mobile-storefront/MOBILE_ARCHITECTURE.md` | Detailed mobile architectural guide. |

---

## 🤖 AI Integration (Genkit)

AI features are orchestrated using Google Genkit.

*   **Location:** `apps/web/src/ai/flows/`
*   **Documentation:** `apps/web/src/ai/flows/_AI_README.md`

### Core AI Flows

1.  **`guideBusinessOnboarding`**
    *   **File:** `guide-business-onboarding.ts`
    *   **Purpose:** Generates a logo/brand palette from business description.
    *   **Input:** `businessName`, `businessType`, `brandPreferences`.
    *   **Output:** `logoDataUri`, `brandColors`.

2.  **`generateProductDescription`**
    *   **File:** `generate-product-descriptions.ts`
    *   **Purpose:** Creates SEO-optimized product descriptions.
    *   **Input:** `productName`, `businessType`, `productDetails`.

3.  **`generateProductFaq`**
    *   **File:** `generate-product-faq.ts`
    *   **Purpose:** Generates common questions and answers for a product.
    *   **Input:** `productName`, `description`.

4.  **`enhanceProductImage`**
    *   **File:** `enhance-product-images.ts`
    *   **Purpose:** Background removal and lighting enhancement.
    *   **Input:** `photoDataUri`.

---

## 🏗️ Architecture & Patterns

### 1. The "Shared Brain" (Web & Mobile)
To ensure data consistency between the Web Storefront and the Mobile App, we use a centralized logic layer:
*   **Supabase Edge Functions:** Handle complex calculations (Pricing, Tax, Shipping).
*   **TanStack Query:** Synchronizes server state.
*   **Real-time:** Both platforms listen to Supabase `postgres_changes`.

### 2. Business Type System
Configuration-driven system to manage business types.
*   **Config:** `apps/web/src/config/business-types.ts`
*   Each type defines a `journey` with specific AI prompts.

### 3. Theming System
*   **Web:** Uses CSS Variables injected at runtime (`--store-primary`).
*   **Mobile:** Uses a dynamic theme provider that fetches brand config on launch.

---

## 🐛 Known Issues & Quick Fixes

1.  **Product Descriptions Use Hardcoded Business Type:**
    *   **File:** `apps/web/src/app/dashboard/products/add/add-product-form.tsx`
    *   **Issue:** `generateProductDescription` call uses hardcoded "Handmade & Crafts".
    *   **Fix:** Inject actual `businessType` from user profile.

2.  **Duplicate AI Calls in Onboarding:**
    *   **File:** `apps/web/src/app/onboarding/onboarding-form.tsx`
    *   **Issue:** Logo generation runs twice (preview + submit).
    *   **Fix:** Implement result caching in form state.

---

## ✅ Common Tasks Guide

### How to Add a New Business Type
1.  Edit `apps/web/src/config/business-types.ts`.
2.  Add entry to `BUSINESS_TYPES`.
3.  The UI updates automatically.

### How to Verify Mobile Builds
1.  Check `baci-mobile-storefront/app.json` for the correct `bundleIdentifier`.
2.  Ensure `expo.extra.supabaseUrl` matches the project environment.