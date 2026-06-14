# Baci E-commerce Platform - Technology Stack (2025)

This document provides a comprehensive overview of the technology stack used to build the Baci platform. It serves as a single source of truth for developers and AI assistants, outlining not just *what* we use, but *why* we use it.

---

## 1. Core Framework

### Next.js 15 (App Router)
- **Framework:** [Next.js](https://nextjs.org/)
- **Version:** `^16.0.5`
- **Why:** Next.js is the leading React framework for production. The App Router enables a powerful combination of Server Components for performance and Client Components for interactivity. This hybrid approach is ideal for a dynamic e-commerce platform.
- **Key Features Used:**
  - **Server Components:** For fast initial page loads and SEO.
  - **Client Components:** For interactive UI like forms and dashboards.
  - **File-Based Routing:** Simplifies navigation and page creation.
  - **API Routes:** For creating serverless backend endpoints (e.g., product feeds, AI proxies).

---

## 2. Frontend

### React 18
- **Library:** [React](https://react.dev/)
- **Version:** `^19.2.0`
- **Why:** The industry standard for building user interfaces. React's component model allows for reusable and maintainable code.
- **Key Features Used:**
  - **Hooks:** (`useState`, `useEffect`, `useContext`) for state management.
  - **Suspense:** For elegant loading states and data fetching.
  - **Server & Client Components:** Following the Next.js 15 paradigm.

### TypeScript
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Why:** Adds static typing to JavaScript, which drastically reduces bugs, improves developer experience with autocompletion, and makes the codebase easier to refactor and maintain. All new code should be written in TypeScript.

---

## 3. Styling & UI

### Tailwind CSS
- **Framework:** [Tailwind CSS](https://tailwindcss.com/)
- **Why:** A utility-first CSS framework that allows for rapid UI development without writing custom CSS. It's highly configurable and works seamlessly with React components.
- **Configuration:** `tailwind.config.mjs`

### shadcn/ui
- **Component Library:** [shadcn/ui](https://ui.shadcn.com/)
- **Why:** A collection of beautifully designed, accessible, and unstyled components that can be easily customized with Tailwind CSS. It's not a traditional component library; instead, we copy its code directly into our project, giving us full control.
- **Location:** `src/components/ui/*`

### Themed Components
- **Architecture:** Custom-built themed component system.
- **Location:** `src/components/themed/*`
- **Why:** This is our unique branding engine. It wraps `shadcn/ui` components and applies the merchant's brand colors dynamically using CSS Custom Properties (variables). This provides a highly performant and scalable way to create unique storefronts.
- **Documentation:** `docs/THEMING_ARCHITECTURE.md`

---

## 4. Backend & Database

### Supabase
- **Platform:** [Supabase](https://supabase.com/)
- **Why:** The leading open-source alternative to Firebase. It provides a full backend-as-a-service (BaaS) solution built on top of PostgreSQL, which is a powerful and scalable relational database.
- **Key Features Used:**
  - **Authentication:** Manages user sign-up, login, and sessions.
  - **Postgres Database:** Stores all merchant and customer data (e.g., in the `merchants` table).
  - **Storage:** (Planned) For storing user-uploaded files like logos and product images.
- **Client:** `@supabase/ssr` for server-side and client-side access.
- **Configuration:** `src/lib/supabase/client.ts` & `src/lib/supabase/server.ts`.

---

## 5. Artificial Intelligence

### Vercel AI SDK
- **Framework:** [Vercel AI SDK](https://sdk.vercel.ai/)
- **Package:** `ai`
- **Why:** An open-source library for building AI-powered user interfaces. It provides simple and powerful helpers for integrating generative UI into our Next.js application, seamlessly handling streaming responses.

### Google AI Provider
- **Provider:** [Google AI](https://ai.google.dev/)
- **Package:** `@ai-sdk/google`
- **Why:** The official AI SDK provider for using Google's models. This allows us to easily access the Gemini family of models within the Vercel AI SDK framework.
- **Location:** `src/ai/provider.ts`

### Gemini Models
- **Models Used:**
  - **`gemini-2.0-flash`:** A fast and cost-effective model used for text-based tasks like generating product descriptions and autofilling form details.
  - **`gemini-2.5-flash-preview-image`:** A powerful multimodal model used for tasks involving images, such as analyzing an uploaded logo to extract brand colors.

---

## 6. Form Management & Validation

### React Hook Form
- **Library:** [React Hook Form](https://react-hook-form.com/)
- **Why:** A performant, flexible, and extensible library for managing forms in React. It minimizes re-renders and integrates perfectly with Zod for validation.
- **Usage:** All forms in the application (onboarding, product creation, checkout) use this library.

### Zod
- **Library:** [Zod](https://zod.dev/)
- **Why:** A TypeScript-first schema declaration and validation library. We use it to define the shape of our data and validate form inputs and AI flow I/O.
- **Key Benefit:** We can infer TypeScript types directly from our validation schemas, eliminating the need to maintain separate type definitions.

---

## 7. Development & Tooling

### npm
- **Package Manager:** [npm](https://www.npmjs.com/)
- **Why:** The default package manager for Node.js, used to manage all project dependencies.

### ESLint & Prettier
- **Linters/Formatters:** Used to enforce a consistent code style and catch common errors before runtime.

### Vercel
- **Hosting Platform:** [Vercel](https://vercel.com/)
- **Why:** The platform built by the creators of Next.js. It offers best-in-class performance, automatic deployments via Git, and a seamless developer experience for hosting Next.js applications.
