# Scalability Review & Recommendations

## Executive Summary
The current Baci codebase is well-structured for an MVP but contains significant architectural bottlenecks that will prevent it from scaling to thousands of products or users. The primary issues are **client-side state management of the entire product catalog**, **inefficient AI prompt construction** that won't scale with catalog size, and **synchronous blocking AI operations**.

## Critical Scalability Issues

### 1. Client-Side State & Data Fetching
**Current Implementation:**
- `ProductProvider` loads all products into memory (`useState`).
- No server-side pagination or filtering is evident in the context provider.

**Risk:**
- Performance will degrade O(n) with catalog size. A merchant with 1,000+ products will experience significant UI lag.
- Initial page load will become prohibitively slow.

**Recommendation:**
- **Move to Server-Side Pagination:** Use **TanStack Query** (React Query) with Supabase.
- Implement `useInfiniteQuery` or standard pagination for the product list.
- Only fetch the data needed for the current view.

### 2. AI Integration (Price List Processing)
**Current Implementation:**
- `processPriceList` takes the *entire* `currentProducts` array and stringifies it into the Gemini prompt.

**Risk:**
- **Context Window Overflow:** A catalog of just a few hundred products will exceed the token limit of the LLM, causing the feature to fail.
- **Cost:** Sending the entire catalog for every request is extremely expensive.
- **Latency:** Processing large JSON blobs in the prompt increases response time.

**Recommendation:**
- **RAG (Retrieval Augmented Generation):** Instead of sending the whole catalog, use a vector search (pgvector on Supabase) to find only the products relevant to the items in the uploaded price list.
- **Batch Processing:** Process the price list in chunks (e.g., 10-20 items at a time) rather than one massive request.

### 3. Synchronous AI Operations
**Current Implementation:**
- AI actions like `generateProductDescription` and `processPriceList` are awaited server-side (`await model.generateContent`).

**Risk:**
- **Timeouts:** Vercel Serverless Functions have a default timeout (usually 10-60s). Complex AI tasks will time out.
- **Blocking UI:** The user has to wait for the process to finish, freezing the interface.

**Recommendation:**
- **Background Jobs:** Use a queueing system (e.g., **Inngest**, **Trigger.dev**, or **Supabase Edge Functions** invoked asynchronously).
- Return a "Processing" status immediately to the UI and update via polling or Realtime subscriptions.

## Database Schema Improvements

### 1. Order Items Normalization
**Current:** `orders.items` is a `JSONB` column.
**Issue:** Impossible to efficiently query "How many of Product X were sold?" or "Top selling products".
**Fix:** Create a separate `order_items` table:
```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  product_id UUID REFERENCES products(id),
  quantity INTEGER,
  price DECIMAL
);
```

### 2. Product Images
**Current:** `image_small`, `image_large` columns.
**Issue:** Limits products to a fixed number of images.
**Fix:** Create a `product_images` table to allow unlimited gallery images per product.

## Summary of Action Items

| Priority | Item | Effort | Impact |
| :--- | :--- | :--- | :--- |
| 🔴 **High** | Implement Server-Side Pagination for Products | Medium | Critical for >100 items |
| 🔴 **High** | Refactor AI Price List Processing (Batching/RAG) | High | Critical for feature viability |
| 🟡 **Medium** | Normalize `order_items` table | Medium | Critical for Analytics |
| 🟡 **Medium** | Move AI tasks to Background Jobs | Medium | Improves UX & Reliability |
