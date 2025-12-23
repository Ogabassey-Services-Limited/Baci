# Content Creation & Algorithmic Authorship

Semantic writing methodology for content that search engines and LLMs can optimally process.

## Critical Content Numbers

| Element | Specification |
|---------|---------------|
| Featured snippet length | **<340 characters, max 40 words** |
| Extractive answer under H2 | **~40 words** |
| Content similarity between pages | **<6%** |
| Update to trigger re-ranking | **30%+ of content** |

## Table of Contents
1. [Algorithmic Authorship Principles](#algorithmic-authorship-principles)
2. [Relevance Configuration](#relevance-configuration)
3. [Macro and Microsemantics](#macro-and-microsemantics)
4. [EAV Content Structure](#eav-content-structure)
5. [Semantic Brief Creation](#semantic-brief-creation)
6. [Writing Guidelines](#writing-guidelines)

## Algorithmic Authorship Principles

Algorithmic Authorship means writing content aligned with how LLMs and search engines process language.

### Core Principle:
Content must be written in alignment with the linguistic patterns of the systems you're communicating with.

### Key Elements:
1. **Sentence Structure** — Subject-Predicate-Object clarity
2. **Vocabulary Richness** — Domain-specific terminology
3. **Information Density** — Maximum value per token
4. **Semantic Clarity** — Unambiguous entity references
5. **Logical Flow** — Clear contextual progression

### What LLMs Need:
- Structured semantic coverage for query expansion
- Clear entity-attribute relationships
- Consistent terminology
- Factual, verifiable statements
- Logical information hierarchy

## Relevance Configuration

Relevance Configuration is the deliberate choice of phrasing to affect how systems retrieve your content.

### Example:
- "sound of bird" vs "bird sounds"
- "e-commerce platform for Nigeria" vs "Nigerian e-commerce platform"
- "how to build online store" vs "building an online store"

These subtle differences shift how LLMs tokenize and match content to queries.

### Guidelines:
1. **Match Query Patterns** — Use phrasing users actually search
2. **Consider Tokenization** — How will this be broken into tokens?
3. **Test Variations** — Different phrasings may rank differently
4. **Maintain Consistency** — Use same phrasing site-wide for concepts

### Practical Application:
For target query: "best phones under 100k naira"
- USE: "best phones under 100k naira" (exact match)
- USE: "phones under ₦100,000" (semantic equivalent)
- AVOID: "affordable mobile devices" (different semantic space)

## Macro and Microsemantics

### Macrosemantic Level:
The overall topic/theme of a document or section.
- What is this page about?
- What topical cluster does it belong to?
- What's the primary entity?

### Microsemantic Level:
Sentence-level and phrase-level semantics.
- Individual EAV statements
- Specific attribute coverage
- Lexical choices

### Document Structure:

```
MACROSEMANTIC: Page Topic
    │
    ├── Section 1 (Macrosemantic)
    │       ├── Paragraph (Microsemantic)
    │       │       └── Sentences (EAV statements)
    │       └── Paragraph (Microsemantic)
    │
    ├── Section 2 (Macrosemantic)
    │       └── ...
    │
    └── Section 3 (Macrosemantic)
            └── ...
```

### Optimization at Each Level:

**Macrosemantic:**
- Clear topic definition
- Proper heading hierarchy
- Section boundaries match topic shifts
- Logical flow between sections

**Microsemantic:**
- Every sentence adds information
- Clear entity references
- Specific attribute values
- No filler or fluff

## Frame Semantics in Content

### What It Is

Frame Semantics explains how verb choice activates mental structures with expected entities and relationships.

### Verb → Frame Mapping

| Verb | Frame Activated | Expected Context |
|------|-----------------|------------------|
| "examine" | Investigation | Research, analysis, medical |
| "consume" | Consumption | Food, media, resources |
| "purchase" | Commerce | Retail, transaction |
| "build" | Construction | Development, creation |
| "compare" | Evaluation | Decision-making, shopping |

### Application to SEO

1. **Match verbs to intent**
   - Transactional pages: "buy", "order", "purchase"
   - Informational pages: "learn", "understand", "discover"
   - Commercial pages: "compare", "review", "evaluate"

2. **Maintain frame consistency**
   - Don't mix incompatible frames on one page
   - If page is transactional, keep transactional verbs throughout

3. **Create frame-based content bridges**
   - "Learn about phones" → "Compare phones" → "Buy phones"
   - Each article links via predicate relationship

## EAV Content Structure

Entity-Attribute-Value (EAV) is how search engines parse and store facts.

### EAV Pattern:
```
Entity: Samsung Galaxy A35
Attribute: price
Value: ₦250,000

Written as: "The Samsung Galaxy A35 is priced at ₦250,000."
           [Entity]                    [Attribute] [Value]
```

### Content Writing with EAV:

**Instead of:**
> "This phone has a really good battery that lasts a long time and you won't need to charge it often."

**Write:**
> "The Samsung Galaxy A35 features a 5000mAh battery that delivers up to 2 days of typical usage on a single charge."

**Why it's better:**
- Entity: Samsung Galaxy A35
- Attribute: battery capacity
- Value: 5000mAh
- Attribute: battery life
- Value: 2 days typical usage

### EAV Checklist for Each Section:
- [ ] Primary entity clearly named
- [ ] Attributes explicitly stated
- [ ] Values are specific (numbers, facts)
- [ ] No ambiguous pronouns
- [ ] No contradictory statements

## Semantic Brief Creation

A semantic brief guides content creation for topical authority.

### Brief Structure:

```
SEMANTIC CONTENT BRIEF

1. TARGET QUERY CLUSTER:
   Primary: [main query]
   Secondary: [related queries]
   Long-tail: [specific variations]

2. CENTRAL ENTITY:
   Name: [entity name]
   Type: [entity type]
   Context: [entity context on this page]

3. ENTITY ATTRIBUTES TO COVER:
   - Attribute 1: [expected value type]
   - Attribute 2: [expected value type]
   - ...

4. RELATED ENTITIES:
   - [Entity A] — relationship: [type]
   - [Entity B] — relationship: [type]

5. SEARCH INTENT:
   Primary: [intent type]
   Secondary: [intent type]

6. MAIN CONTENT SECTIONS:
   H2: [Section 1 — covers attributes X, Y]
   H2: [Section 2 — covers attributes Z, W]
   ...

7. SUPPLEMENTARY CONTENT:
   - FAQ questions
   - Related topics to link
   - Comparison opportunities

8. QUALITY SIGNALS:
   - Data/statistics to include
   - Sources to cite
   - Original insights needed
```

### Brief Example (OgaBassey Product Page):

```
SEMANTIC CONTENT BRIEF

1. TARGET QUERY CLUSTER:
   Primary: "Samsung Galaxy A35 price Nigeria"
   Secondary: "Samsung A35 specs", "buy Samsung A35 Lagos"
   Long-tail: "Samsung A35 vs A34", "Samsung A35 installment payment"

2. CENTRAL ENTITY:
   Name: Samsung Galaxy A35
   Type: Smartphone
   Context: Product for sale

3. ENTITY ATTRIBUTES TO COVER:
   - Price: NGN amount, installment options
   - Display: size, type, resolution
   - Battery: capacity, charging speed
   - Camera: megapixels, features
   - Storage: capacity, expandable
   - Availability: stock status, delivery
   - Warranty: duration, coverage

4. RELATED ENTITIES:
   - Samsung (brand) — parent
   - Galaxy A34 (product) — predecessor
   - iPhone 14 (product) — competitor
   - OgaBassey (retailer) — seller

5. SEARCH INTENT:
   Primary: Transactional (buy)
   Secondary: Commercial (compare)

6. MAIN CONTENT SECTIONS:
   H2: Samsung Galaxy A35 Price in Nigeria
   H2: Key Specifications
   H2: Camera Features
   H2: Battery and Performance
   H2: How to Buy (Installment Options)

7. SUPPLEMENTARY CONTENT:
   - FAQ: warranty, delivery, returns
   - Link to: A-series comparison, phone accessories
   - Compare: vs A34, vs iPhone 14

8. QUALITY SIGNALS:
   - Original product photos
   - Real pricing (updated regularly)
   - Customer reviews
   - Expert verdict
```

## Writing Guidelines

### Information Density Rules:

1. **Every sentence must add information**
   - No filler phrases
   - No redundant statements
   - No vague claims

2. **Be specific, always**
   - BAD: "great battery life"
   - GOOD: "5000mAh battery with 2-day typical usage"

3. **Use numbers**
   - BAD: "affordable price"
   - GOOD: "₦250,000 (or ₦25,000/month for 10 months)"

4. **Name entities explicitly**
   - BAD: "This phone has..."
   - GOOD: "The Samsung Galaxy A35 has..."

### Structural Rules:

1. **H2s as questions with 40-word extractive answers**
   ```
   ## What is the Samsung Galaxy A35 Price in Nigeria?
   
   The Samsung Galaxy A35 is priced at ₦250,000 at OgaBassey, with 
   installment options available through Zilla starting at ₦25,000 
   per month for 10 months, making it accessible for budget-conscious 
   buyers seeking premium features.
   ```
   *This answer is exactly 40 words — optimal for featured snippet extraction.*

2. **Clear section boundaries**
   - One main topic per section
   - Distinct from adjacent sections
   - Internal linking at section transitions

3. **Heading hierarchy**
   - H1: Page title (one per page)
   - H2: Major sections
   - H3: Subsections
   - Never skip levels

### Citation and Authority Rules:

1. **2+ citations per major heading**
   - Link to authoritative sources
   - Reference manufacturer specs
   - Cite industry data

2. **Demonstrate expertise**
   - Use domain-specific terminology
   - Show nuanced understanding
   - Address edge cases

3. **Include original elements**
   - Original photos
   - Original analysis
   - Unique insights

### What to Avoid:

- Hedging language ("might", "could", "possibly")
- Filler phrases ("it's important to note", "as we all know")
- Ambiguous pronouns without clear referents
- Contradicting earlier statements
- Generic descriptions that apply to anything
- Copying competitor or manufacturer text verbatim
