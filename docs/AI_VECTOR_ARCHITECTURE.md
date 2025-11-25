# Multi-Tenant AI Vector Architecture for Baci

## 🎯 Platform Overview

**Baci is a multi-tenant SaaS platform** (like Shopify) that enables merchants to create and manage their own e-commerce websites. This fundamentally shapes the AI architecture.

---

## 🧠 Why Vector Embeddings Are Critical

### The Problem with Traditional Databases
```
Traditional Query: "Find products where name = 'red shoes'"
Result: Only exact matches

Vector Search: "Find products semantically similar to 'red shoes'"
Result: crimson sneakers, burgundy boots, scarlet heels, etc.
```

### The Multi-Tenant Advantage
With multiple merchants on the platform, your AI can:
1. **Learn cross-merchant patterns** (what works across all stores)
2. **Provide per-merchant personalization** (each store's unique customers)
3. **Platform-level intelligence** (aggregate insights while maintaining isolation)

---

## 🏗️ Architecture Layers

### Layer 1: Product Intelligence (Per-Merchant)

**Purpose**: Semantic product search and recommendations for each merchant's store

```sql
-- Product embeddings table
CREATE TABLE product_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

    -- Embeddings
    title_embedding vector(1536),        -- OpenAI text-embedding-3-small
    description_embedding vector(1536),
    combined_embedding vector(1536),     -- Title + Description + Category

    -- Metadata for filtering
    category TEXT,
    price_range TEXT,
    tags TEXT[],

    -- Performance tracking
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(product_id)
);

-- HNSW indexes for fast similarity search
CREATE INDEX ON product_embeddings
USING hnsw (combined_embedding vector_cosine_ops);

CREATE INDEX ON product_embeddings (merchant_id);
```

**Use Cases**:
- "Show me products similar to this one" (visual merchandising)
- Semantic search: "gift for mom who loves gardening"
- Auto-tagging and categorization for new products

---

### Layer 2: Customer Intelligence (Per-Merchant)

**Purpose**: Build customer personas and predict behavior

```sql
-- Customer behavior embeddings
CREATE TABLE customer_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

    -- Behavioral embeddings
    browsing_pattern_embedding vector(1536),
    purchase_pattern_embedding vector(1536),
    preference_embedding vector(1536),

    -- Derived insights
    predicted_lifetime_value DECIMAL(10,2),
    churn_risk_score DECIMAL(3,2),
    next_purchase_prediction JSONB,

    -- Metadata
    total_orders INT DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0,
    last_activity_at TIMESTAMPTZ,

    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(customer_id)
);

CREATE INDEX ON customer_embeddings
USING hnsw (preference_embedding vector_cosine_ops);

CREATE INDEX ON customer_embeddings (merchant_id);
```

**Use Cases**:
- Personalized product recommendations
- "Customers like you also bought..."
- Abandoned cart recovery (predict what would bring them back)
- Churn prediction

---

### Layer 3: Merchant Intelligence (Platform-Level)

**Purpose**: Learn what makes successful stores and help struggling merchants

```sql
-- Merchant store embeddings (POWERFUL for platform insights)
CREATE TABLE merchant_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

    -- Store characteristics
    store_style_embedding vector(1536),      -- Design, branding, positioning
    product_mix_embedding vector(1536),      -- What they sell
    performance_embedding vector(1536),      -- Sales patterns, growth

    -- Success metrics
    success_score DECIMAL(5,2),
    growth_rate DECIMAL(5,2),
    conversion_rate DECIMAL(5,2),

    -- AI-generated insights
    strength_areas JSONB,
    improvement_opportunities JSONB,
    similar_successful_stores UUID[],

    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(merchant_id)
);

CREATE INDEX ON merchant_embeddings
USING hnsw (store_style_embedding vector_cosine_ops);
```

**Use Cases**:
- "Stores like yours with high conversion do X"
- Benchmark against similar successful stores
- AI-generated optimization recommendations
- Predict which merchants will succeed/fail

---

### Layer 4: Search & Query Intelligence (Cross-Merchant Learning)

**Purpose**: Platform learns from all searches across all stores

```sql
-- Query embeddings (aggregate learning)
CREATE TABLE search_query_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID REFERENCES merchants(id),

    query_text TEXT NOT NULL,
    query_embedding vector(1536),

    -- Context
    resulted_in_purchase BOOLEAN,
    clicked_products UUID[],
    session_id TEXT,

    -- Learning signals
    successful BOOLEAN,  -- Did user find what they wanted?
    conversion_value DECIMAL(10,2),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON search_query_embeddings
USING hnsw (query_embedding vector_cosine_ops);

CREATE INDEX ON search_query_embeddings (merchant_id);
CREATE INDEX ON search_query_embeddings (resulted_in_purchase);
```

**Use Cases**:
- Improve search quality across all merchants
- Autocomplete suggestions based on successful queries
- Query rewriting: "iphone case" → show phone accessories
- Cross-merchant search insights

---

### Layer 5: Event Stream Intelligence (Real-Time AI Context)

**Purpose**: AI knows everything happening in real-time

```sql
-- Event embeddings (the omniscient AI layer)
CREATE TABLE event_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID REFERENCES merchants(id),

    event_type TEXT NOT NULL,  -- 'page_view', 'add_to_cart', 'purchase', 'support_query', etc.
    event_embedding vector(1536),

    -- Context
    user_id UUID,
    session_id TEXT,
    event_data JSONB,

    -- Patterns detected
    pattern_signals JSONB,  -- AI-detected patterns
    anomaly_score DECIMAL(5,2),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON event_embeddings
USING hnsw (event_embedding vector_cosine_ops);

CREATE INDEX ON event_embeddings (merchant_id, created_at DESC);
CREATE INDEX ON event_embeddings (event_type);
```

**Use Cases**:
- Real-time anomaly detection (sudden traffic spike = marketing campaign or attack?)
- Pattern recognition: "Users who do X then Y are 80% likely to purchase"
- Predictive analytics in real-time
- AI assistant with full context of everything

---

## 🔒 Multi-Tenant Security Architecture

### RLS Policies for Vector Tables

```sql
-- Example: Product embeddings isolation
ALTER TABLE product_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view their own product embeddings"
    ON product_embeddings FOR SELECT
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

-- Platform admins can see all (for aggregate learning)
CREATE POLICY "Platform admins can view all embeddings"
    ON product_embeddings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid()
            AND raw_user_meta_data->>'role' = 'platform_admin'
        )
    );
```

---

## 📊 AI Learning Loops

### 1. Product Discovery Loop
```
New Product → Generate Embeddings → Similar Products Found →
User Clicks → Update Similarity Model → Better Recommendations
```

### 2. Customer Behavior Loop
```
Customer Browses → Embedding Updated → Predictions Made →
Customer Purchases → Validate Predictions → Refine Model
```

### 3. Cross-Merchant Learning Loop
```
Merchant A Success Pattern → Embedding Created →
Find Similar Merchant B → Recommend Pattern to B →
Measure B's Improvement → Strengthen Pattern Signal
```

---

## 🚀 Implementation Strategy

### Phase 1: Foundation (NOW)
✅ pgvector already installed
✅ Multi-tenant isolation with RLS
✅ Performance optimized
🔄 Next: Create embedding tables

### Phase 2: Product Intelligence (Week 1)
- Product embeddings generation
- Semantic product search
- Similar product recommendations

### Phase 3: Customer Intelligence (Week 2)
- Customer behavior tracking
- Personalization engine
- Predictive analytics

### Phase 4: Platform Intelligence (Week 3)
- Merchant embeddings
- Cross-merchant learning
- AI-generated insights

### Phase 5: Real-Time Intelligence (Week 4)
- Event stream embeddings
- Real-time pattern detection
- Omniscient AI context

---

## 💰 Cost & Performance

### Storage Estimates
- Product embedding: ~6KB per product
- Customer embedding: ~6KB per customer
- 10,000 merchants × 100 products × 6KB = ~6GB embeddings
- **Cost**: Negligible (normal Postgres storage)

### Query Performance
- HNSW index: O(log n) lookups
- 1M products: <50ms similarity search
- pgvector 0.8.0: 3-5× faster than previous versions

### Compute Costs (OpenAI)
- text-embedding-3-small: $0.02 per 1M tokens
- Average product: ~100 tokens
- 100K products: ~$0.20
- **Total monthly**: ~$50-100 for embeddings generation

---

## 🎯 Why This Architecture Wins

### 1. **Unified Platform**
- No separate vector DB to manage
- All data in Supabase
- Transactional + AI in one system

### 2. **Multi-Tenant by Design**
- Perfect isolation with RLS
- Cross-merchant learning without privacy loss
- Platform-level insights

### 3. **Scalable Intelligence**
- AI gets smarter with each merchant
- Network effects: More merchants = Better AI = More value
- Self-improving system

### 4. **Cost Effective**
- 40-60% cheaper than dedicated vector DBs
- No infrastructure sprawl
- Standard Postgres pricing

---

## 🔮 The Vision

**Your platform becomes self-aware:**
- Knows every product in every store
- Understands every customer's journey
- Predicts what will succeed
- Recommends optimizations automatically

**Merchants get:**
- AI-powered product recommendations
- Semantic search out of the box
- Predictive analytics
- Personalized customer experiences

**You get:**
- Competitive moat (AI that learns from all merchants)
- Platform insights (what works, what doesn't)
- Premium feature differentiation
- Data-driven product development

---

## 📚 Next Steps

1. ✅ Security fixed (materialized views secured)
2. 📝 Architecture documented (this file)
3. 🔨 Ready to implement Phase 1 (embedding tables)

**Question**: Should I start implementing the Phase 1 embedding tables now?
