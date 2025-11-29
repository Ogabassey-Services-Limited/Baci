# Architecture Diagrams

## Background AI Jobs Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│                                                                 │
│  ┌──────────────┐                                              │
│  │ Products     │  User pastes price list                      │
│  │ Dashboard    │  ──────────────────────────────┐             │
│  └──────────────┘                                 │             │
│         │                                          ▼             │
│         │                                  ┌──────────────┐     │
│         │                                  │ Create Job   │     │
│         │                                  │ POST /api/   │     │
│         │                                  │  ai-jobs     │     │
│         │                                  └──────────────┘     │
│         │                                          │             │
│         │                                          ▼             │
│         │                                  ┌──────────────┐     │
│         │                                  │ Job ID       │     │
│         │                                  │ Returned     │     │
│         │                                  └──────────────┘     │
│         │                                          │             │
│         │                                          ▼             │
│         │                                  ┌──────────────┐     │
│         │◄─────────────────────────────────│ Start        │     │
│         │  Poll every 2s                   │ Polling      │     │
│         │                                  └──────────────┘     │
│         │                                                        │
│         │  ┌──────────────┐                                     │
│         └─►│ GET /api/    │                                     │
│            │ ai-jobs/[id] │                                     │
│            └──────────────┘                                     │
│                    │                                             │
│                    ▼                                             │
│            ┌──────────────┐                                     │
│            │ Job Status:  │                                     │
│            │ pending/     │                                     │
│            │ processing/  │                                     │
│            │ completed    │                                     │
│            └──────────────┘                                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      BACKGROUND WORKER                          │
│                                                                 │
│  ┌──────────────┐                                              │
│  │ Vercel Cron  │  Every 2 minutes                             │
│  │ Job          │  ──────────────────────────────┐             │
│  └──────────────┘                                 │             │
│                                                    ▼             │
│                                            ┌──────────────┐     │
│                                            │ POST /api/   │     │
│                                            │ ai-jobs/     │     │
│                                            │ worker       │     │
│                                            └──────────────┘     │
│                                                    │             │
│                                                    ▼             │
│                                            ┌──────────────┐     │
│                                            │ Fetch 5      │     │
│                                            │ Pending Jobs │     │
│                                            └──────────────┘     │
│                                                    │             │
│                                                    ▼             │
│                                            ┌──────────────┐     │
│                                            │ For Each Job │     │
│                                            │ ─────────────┤     │
│                                            │ 1. Mark as   │     │
│                                            │   processing │     │
│                                            │ 2. Call      │     │
│                                            │   Gemini AI  │     │
│                                            │ 3. Store     │     │
│                                            │   result     │     │
│                                            │ 4. Mark as   │     │
│                                            │   completed  │     │
│                                            └──────────────┘     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                          DATABASE                               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                     ai_jobs Table                        │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ id              │ UUID (PK)                              │  │
│  │ merchant_id     │ UUID (FK → merchants)                  │  │
│  │ type            │ TEXT (price_list_processing, etc.)     │  │
│  │ status          │ TEXT (pending/processing/completed)    │  │
│  │ input           │ JSONB (job parameters)                 │  │
│  │ output          │ JSONB (AI response)                    │  │
│  │ error           │ TEXT (error message if failed)         │  │
│  │ created_at      │ TIMESTAMP                              │  │
│  │ started_at      │ TIMESTAMP                              │  │
│  │ completed_at    │ TIMESTAMP                              │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Server-Side Pagination Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│                                                                 │
│  ┌──────────────┐                                              │
│  │ Products     │  User opens page                             │
│  │ Dashboard    │  ──────────────────────────────┐             │
│  └──────────────┘                                 │             │
│         │                                          ▼             │
│         │                                  ┌──────────────┐     │
│         │                                  │ ProductContext│     │
│         │                                  │ useEffect()  │     │
│         │                                  └──────────────┘     │
│         │                                          │             │
│         │                                          ▼             │
│         │                                  ┌──────────────┐     │
│         │                                  │ GET /api/    │     │
│         │                                  │ products?    │     │
│         │                                  │ page=1&      │     │
│         │                                  │ limit=10     │     │
│         │                                  └──────────────┘     │
│         │                                          │             │
│         │                                          ▼             │
│         │◄─────────────────────────────────┌──────────────┐     │
│         │  Response:                       │ API fetches  │     │
│         │  - products (10 items)           │ from DB with │     │
│         │  - pagination info               │ LIMIT/OFFSET │     │
│         │  - stats                         └──────────────┘     │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                              │
│  │ Display:     │                                              │
│  │ - 10 products│                                              │
│  │ - Page 1/15  │                                              │
│  │ - Stats      │                                              │
│  │ - Pagination │                                              │
│  │   controls   │                                              │
│  └──────────────┘                                              │
│         │                                                        │
│         │  User clicks "Next"                                   │
│         │  ──────────────────────────────┐                     │
│         │                                 ▼                     │
│         │                         ┌──────────────┐             │
│         │                         │ setPage(2)   │             │
│         │                         └──────────────┘             │
│         │                                 │                     │
│         │                                 ▼                     │
│         │                         ┌──────────────┐             │
│         │                         │ Fetch page 2 │             │
│         │◄────────────────────────│ GET /api/    │             │
│         │                         │ products?    │             │
│         │                         │ page=2       │             │
│         │                         └──────────────┘             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                          DATABASE                               │
│                                                                 │
│  SELECT * FROM products                                         │
│  WHERE merchant_id = $1                                         │
│  AND (status = $2 OR $2 = 'All')                               │
│  AND (name ILIKE $3 OR $3 = '')                                │
│  ORDER BY created_at DESC                                       │
│  LIMIT 10 OFFSET 10  ◄── Efficient pagination                  │
│                                                                 │
│  Result: 10 products (rows 11-20)                              │
└─────────────────────────────────────────────────────────────────┘
```

## Order Items Normalization

### Before (JSONB)
```
┌─────────────────────────────────────────┐
│           orders Table                  │
├─────────────────────────────────────────┤
│ id          │ UUID                      │
│ merchant_id │ UUID                      │
│ customer_id │ UUID                      │
│ items       │ JSONB ◄── Problem!        │
│             │ [{                        │
│             │   product_id: "p1",       │
│             │   name: "Mug",            │
│             │   quantity: 2,            │
│             │   price: 49.99            │
│             │ }, ...]                   │
│ total       │ DECIMAL                   │
└─────────────────────────────────────────┘

❌ Can't efficiently query:
   - Top selling products
   - Product sales over time
   - Revenue by product
```

### After (Normalized)
```
┌─────────────────────────────────────────┐
│           orders Table                  │
├─────────────────────────────────────────┤
│ id          │ UUID                      │
│ merchant_id │ UUID                      │
│ customer_id │ UUID                      │
│ total       │ DECIMAL                   │
└─────────────────────────────────────────┘
              │
              │ 1:N relationship
              ▼
┌─────────────────────────────────────────┐
│        order_items Table                │
├─────────────────────────────────────────┤
│ id          │ UUID                      │
│ order_id    │ UUID (FK → orders)        │
│ product_id  │ UUID (FK → products)      │
│ name        │ TEXT                      │
│ quantity    │ INTEGER                   │
│ price       │ DECIMAL                   │
└─────────────────────────────────────────┘

✅ Can efficiently query:
   SELECT product_id, SUM(quantity) as total_sold
   FROM order_items
   GROUP BY product_id
   ORDER BY total_sold DESC
   LIMIT 10;
```

## System Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                          │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                │
│  │ Products   │  │ Orders     │  │ Dashboard  │                │
│  │ Page       │  │ Page       │  │ Page       │                │
│  └────────────┘  └────────────┘  └────────────┘                │
│         │               │               │                        │
└─────────┼───────────────┼───────────────┼────────────────────────┘
          │               │               │
          ▼               ▼               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    NEXT.JS API ROUTES                            │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                │
│  │ /api/      │  │ /api/      │  │ /api/      │                │
│  │ products   │  │ orders     │  │ ai-jobs    │                │
│  └────────────┘  └────────────┘  └────────────┘                │
│         │               │               │                        │
│         │               │               │                        │
│         ▼               ▼               ▼                        │
│  ┌──────────────────────────────────────────┐                   │
│  │         Supabase Client (RLS)            │                   │
│  └──────────────────────────────────────────┘                   │
└──────────────────────────────────────────────────────────────────┘
          │               │               │
          ▼               ▼               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      SUPABASE (PostgreSQL)                       │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                │
│  │ products   │  │ orders     │  │ ai_jobs    │                │
│  │ table      │  │ table      │  │ table      │                │
│  └────────────┘  └────────────┘  └────────────┘                │
│         │               │                                        │
│         │               └──────┐                                 │
│         │                      ▼                                 │
│         │              ┌────────────┐                           │
│         │              │order_items │                           │
│         │              │ table      │                           │
│         │              └────────────┘                           │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    BACKGROUND WORKER                             │
│                                                                  │
│  ┌────────────────────────────────────────────────────┐         │
│  │  Vercel Cron (every 2 min)                         │         │
│  │         │                                           │         │
│  │         ▼                                           │         │
│  │  POST /api/ai-jobs/worker                          │         │
│  │         │                                           │         │
│  │         ▼                                           │         │
│  │  Supabase Service Role Client (bypass RLS)         │         │
│  │         │                                           │         │
│  │         ▼                                           │         │
│  │  Process pending jobs                              │         │
│  │         │                                           │         │
│  │         ▼                                           │         │
│  │  Google Gemini AI                                  │         │
│  └────────────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────────────┘
```
