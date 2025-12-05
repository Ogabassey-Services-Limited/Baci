# Gemini AI Assistant Context File

**Project:** Baci AI E-commerce Builder
**Last Updated:** 2025-11-02

This document provides essential context for AI assistants working on this codebase. Please review it carefully before making any changes.

---

## 🚨 Critical Rules - READ THIS FIRST

1.  **Business Types are Configuration-Driven:**
    *   **Single Source of Truth:** `/src/config/business-types.ts`.
    *   **NEVER** hardcode business types in components or AI flows. Import from the config file.
    *   To add or modify business types, edit this file. The UI and AI prompts will update automatically.
    *   See ADR 001 for the full architecture: `/docs/adr/001-business-type-journey-architecture.md`.

2.  **AI Flow Signatures are Strict:**
    *   AI flows are located in `/src/ai/flows/`.
    *   Input and output schemas are defined with Zod.
    *   **NEVER** modify a flow's signature without updating all calling components. Use `grep` to find all usages before changing schemas.

3.  **Theming is CSS Variable-Based:**
    *   Merchant brand colors are applied via CSS variables (e.g., `var(--store-primary)`).
    *   Color definitions are in `/src/app/globals.css`.
    *   Use themed components from `/src/components/themed/` which automatically use these variables.
    *   **DO NOT** hardcode colors.
    *   See the architecture guide: `/docs/THEMING_ARCHITECTURE.md`.

4.  **Forms use React Hook Form + Zod:**
    *   Define a Zod schema first for validation.
    *   Use the `zodResolver`.
    *   Use the `<FormField>` components from `/src/components/ui/form.tsx`.

5.  **Data Access through Hooks and Services:**
    *   All Supabase operations (authentication, database queries) are abstracted into hooks (e.g., `useAuth`, `useMerchant`) and server actions.
    *   Components should use these abstractions and **NOT** interact with the Supabase client directly.

---

## 🚀 Project Overview

Baci is a Next.js application that allows merchants to create an e-commerce store using AI. The core features include an AI-driven onboarding flow for logo and brand color generation, AI-powered product description creation, and a customizable storefront.

*   **Project Blueprint:** `/docs/blueprint.md`
*   **Initial Project Brief:** `/project_brief.md`

### Technology Stack

| Category      | Technology                                       | Why                                                                                             |
| :------------ | :----------------------------------------------- | :---------------------------------------------------------------------------------------------- |
| **Framework** | Next.js 15 (App Router)                          | Server Components for performance, Client Components for interactivity.                         |
| **Language**  | TypeScript                                       | Enforces type safety, reducing bugs and improving developer experience.                         |
| **Styling**   | Tailwind CSS + shadcn/ui                         | Utility-first CSS for rapid development and a set of accessible, customizable components.       |
| **Branding**  | Custom Themed Components (`/src/components/themed`) | A performant, CSS variable-driven system to apply merchant brand colors.                        |
| **Backend**   | Supabase                                         | A full-featured, open-source backend-as-a-service providing auth, database, and storage.      |
| **AI**        | Google Genkit + Gemini Models                    | An open-source framework for building robust, production-ready AI flows with powerful models.     |
| **Forms**     | React Hook Form + Zod                            | A performant solution for form state management with robust, type-safe validation.              |

*   **Detailed Tech Stack:** `techstack.md`

---

## 📁 Key File Locations

| Path                                                     | Purpose                                                                                             |
| :------------------------------------------------------- | :-------------------------------------------------------------------------------------------------- |
| `/AI_CONTEXT.md`                                         | The original, more detailed AI context file. **Refer to it for in-depth information.**              |
| `/src/config/business-types.ts`                          | **Single source of truth for all business categories.** Defines AI prompts, icons, and journeys.    |
| `/src/app/onboarding/onboarding-form.tsx`                | The main 3-step onboarding wizard component. Contains core business logic for setup.                |
| `/src/app/dashboard/products/add/add-product-form.tsx`   | The form for adding new products, with AI-assisted description generation.                          |
| `/src/ai/flows/`                                         | Directory containing all Genkit AI flows (logo generation, product descriptions, etc.).             |
| `/src/components/themed/`                                | Our custom, brand-aware component library that wraps shadcn/ui components.                          |
| `/src/templates/`                                        | Storefront templates that define the layout and style of the merchant's shop.                       |
| `/docs/`                                                 | Contains all high-level documentation, including ADRs, guides, and summaries.                       |

---

## 🤖 AI Integration (Genkit)

AI features are orchestrated using Google Genkit. All flows are defined in `/src/ai/flows/`.

*   **AI README:** `/src/ai/flows/_AI_README.md`
*   **Genkit Dev UI:** Run `npm run genkit:dev` and go to `http://localhost:4000` to test flows.

### Core AI Flows

1.  **`guideBusinessOnboarding`**
    *   **File:** `guide-business-onboarding.ts`
    *   **Purpose:** Generates a logo and/or extracts a 5-color brand palette from an uploaded logo.
    *   **Input:** `businessName`, `businessType`, `brandPreferences`, optional `logoDataUri`.
- **Output:** `logoDataUri` (if generated), `brandColors` (array of 3 hex codes).

2.  **`generateProductDescription`**
    *   **File:** `generate-product-descriptions.ts`
    *   **Purpose:** Creates a compelling product description tailored to the business type.
    *   **Input:** `productName`, `businessType`, `productDetails`.
    *   **Output:** `description` (string).
3.  **enhanceProductImage**
    *   **File:** `enhance-product-images.ts`
    *   **Purpose:** Removes the background from a product photo and enhances the lighting.
    *   **Input:** `photoDataUri`.
    *   **Output:** `enhancedPhotoDataUri`.

---

## 🏗️ Architecture & Patterns

### Business Type System (ADR 001)

The platform uses a configuration-driven system to manage business types. This allows for easy extension and customization without code changes.

*   **ADR:** `/docs/adr/001-business-type-journey-architecture.md`
*   **Configuration:** `/src/config/business-types.ts`

Each business type in the config defines its own `journey`, including specific AI prompt guidance for logo style, color schemes, and product description styles.

### Theming & Template Architecture

The storefront's look and feel is determined by a combination of the merchant's brand colors and a selected template.

*   **Theming Guide:** `/docs/THEMING_ARCHITECTURE.md`
*   **Template Creation Guide:** `/docs/CREATE_TEMPLATE_GUIDE.md`

1.  **Color Extraction:** A web worker extracts 3 key colors from the merchant's logo.
2.  **CSS Variables:** These colors are injected as CSS variables (e.g., `--store-primary`).
3.  **Themed Components:** Components in `/src/components/themed/` use these variables.
4.  **Templates:** Components in `/src/templates/` provide the overall page structure and layout, using the themed components.

---

## 🐛 Known Issues & Quick Fixes

1.  **Product Descriptions Use Hardcoded Business Type:**
    *   **File:** `/src/app/dashboard/products/add/add-product-form.tsx`
    *   **Issue:** The `generateProductDescription` flow is always called with `"Handmade & Crafts"`.
    *   **Fix:** This needs to be updated to use the actual business type of the merchant, which should be fetched from the user's profile/session.

2.  **Duplicate AI Calls in Onboarding:**
    *   **File:** `/src/app/onboarding/onboarding-form.tsx`
    *   **Issue:** If a user uploads a logo, the color extraction flow is called once for the preview and again on final submission.
    *   **Fix:** Cache the result of the first call in the form state and skip the second call on submit.

---

## ✅ Common Tasks Guide

### How to Add a New Business Type

1.  **Edit the config file:** `/src/config/business-types.ts`.
2.  Add a new entry to the `BUSINESS_TYPES` object, following the existing structure. Define the `id`, `label`, `description`, `icon`, `aiPromptContext`, and `journey` properties.
3.  **That's it.** The onboarding dropdown and AI prompts will automatically use the new configuration.

### How to Create a New Storefront Template

1.  **Create a new component:** Create a file like `my-template.tsx` in `/src/templates/`.
2.  The component should accept `{ children: React.ReactNode }` as a prop and render the children within your custom layout.
3.  Use themed components (`ThemedButton`, `ThemedCard`, etc.) and CSS variables (`var(--store-primary)`) to make your template brand-aware.
4.  **Register the template:** Import your new template in `/src/config/business-types.ts` and assign it to one or more business types.
5.  **Read the guide:** For a detailed walkthrough, see `/docs/CREATE_TEMPLATE_GUIDE.md`.
