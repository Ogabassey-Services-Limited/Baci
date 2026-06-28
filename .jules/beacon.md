2024-05-18 — Use JsonLd for schema types
Learning: Manual <script> tags for application/ld+json schemas on public pages like Terms and Privacy might cause issues or bypass structured data validation processes.
Action: Replace raw dangerouslySetInnerHTML and stringified JSON script tags with the safe `JsonLd` component from `@/components/seo/json-ld` cast with correct `schema-dts` types like `JsonLdData<WebPage>`.
Source: apps/web/src/components/seo/json-ld.tsx
