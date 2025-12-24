# WordPress Blog Migration System

## Vision

A self-service feature allowing merchants to migrate their WordPress blogs to Baci by simply uploading a WordPress export file (XML or ZIP backup).

**User Flow**:
1. Merchant goes to Dashboard → Blog → Import
2. Uploads WordPress export (XML) or full backup (ZIP)
3. System automatically extracts, transforms, and imports posts
4. Merchant reviews imported posts in draft status
5. Bulk publish when ready

---

## Phase 1: Manual Migration (Ogabassey Pilot)

### Objective
Migrate ogabassey's WordPress blog (219 posts) from `blog.ogabassey.com` to `ogabassey.com/blog` while documenting all issues and building reusable scripts.

### Source Details
- **Server**: `bassey@82.29.190.219:/var/www/blog/`
- **Database**: `ogabahvg_wp59281`, prefix: `wpgo_`
- **Posts**: 219 published articles
- **Categories**: Mobile Gadgets (136), Reviews (81), Tips & Tricks (49), Tech News (35), How to Guides (17), Laptops (1)
- **SEO Plugin**: Rank Math
- **Page Builder**: Elementor

### Migration Log

#### Step 1: Data Extraction
**Status**: Pending
**Script**: `scripts/wordpress-migration/extract-wp-posts.ts`

**Issues Encountered**:
- [ ] _None yet_

**Solutions Applied**:
- [ ] _None yet_

---

#### Step 2: Image Migration
**Status**: Pending
**Script**: `scripts/wordpress-migration/migrate-images.ts`

**Issues Encountered**:
- [ ] _None yet_

**Solutions Applied**:
- [ ] _None yet_

---

#### Step 3: Content Transformation
**Status**: Pending
**Script**: `scripts/wordpress-migration/transform-content.ts`

**Known Challenges**:
- Elementor shortcodes need stripping
- 166 posts lack internal links (need auto-linking)
- Image URLs need CDN replacement

**Issues Encountered**:
- [ ] _None yet_

**Solutions Applied**:
- [ ] _None yet_

---

#### Step 4: Supabase Import
**Status**: Pending
**Script**: `scripts/wordpress-migration/insert-posts.ts`

**Issues Encountered**:
- [ ] _None yet_

**Solutions Applied**:
- [ ] _None yet_

---

#### Step 5: 301 Redirects
**Status**: Pending
**File**: `src/proxy.ts`

**Issues Encountered**:
- [ ] _None yet_

**Solutions Applied**:
- [ ] _None yet_

---

#### Step 6: Validation & QA
**Status**: Pending
**Script**: `scripts/wordpress-migration/validate-migration.ts`

**Checklist**:
- [ ] All 219 posts accessible
- [ ] Images loading from CDN
- [ ] SEO meta preserved
- [ ] Internal links working
- [ ] RSS feed functional
- [ ] Sitemap includes blog posts
- [ ] 301 redirects working

---

## Phase 2: Reusable Import Feature

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Merchant Dashboard                        │
│                    /dashboard/blog/import                    │
└─────────────────────┬───────────────────────────────────────┘
                      │ Upload XML/ZIP
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  API: /api/blog/import                       │
│  1. Parse WordPress XML (WXR format)                        │
│  2. Extract posts, categories, tags, images                 │
│  3. Download & optimize images → Supabase Storage           │
│  4. Transform content (strip shortcodes, update URLs)       │
│  5. Insert into blog_posts as drafts                        │
└─────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Import Review UI                                │
│  - Preview imported posts                                    │
│  - Fix/edit before publishing                               │
│  - Bulk publish                                              │
└─────────────────────────────────────────────────────────────┘
```

### WordPress Export Format (WXR)

WordPress uses WXR (WordPress eXtended RSS) format for exports:

```xml
<item>
  <title>Post Title</title>
  <link>https://example.com/post-slug</link>
  <pubDate>Mon, 01 Jan 2025 12:00:00 +0000</pubDate>
  <dc:creator>author</dc:creator>
  <content:encoded><![CDATA[HTML content here]]></content:encoded>
  <excerpt:encoded><![CDATA[Excerpt here]]></excerpt:encoded>
  <wp:post_name>post-slug</wp:post_name>
  <wp:status>publish</wp:status>
  <wp:post_type>post</wp:post_type>
  <category domain="category" nicename="tech">Tech</category>
  <category domain="post_tag" nicename="iphone">iPhone</category>
  <wp:postmeta>
    <wp:meta_key>_thumbnail_id</wp:meta_key>
    <wp:meta_value>123</wp:meta_value>
  </wp:postmeta>
</item>
```

### Files to Create (Phase 2)

| File | Purpose |
|------|---------|
| `src/app/dashboard/blog/import/page.tsx` | Import UI with file upload |
| `src/app/api/blog/import/route.ts` | Handle file upload & processing |
| `src/lib/wordpress-parser.ts` | Parse WXR XML format |
| `src/lib/content-transformer.ts` | Strip shortcodes, fix links |
| `src/components/dashboard/blog/ImportPreview.tsx` | Preview imported posts |

### Supported WordPress Plugins

Track compatibility with common WordPress setups:

| Plugin | Status | Notes |
|--------|--------|-------|
| Gutenberg (default) | Planned | Native HTML blocks |
| Elementor | In Progress | Strip shortcodes |
| WPBakery | Planned | Strip [vc_*] shortcodes |
| Rank Math SEO | In Progress | Extract meta from postmeta |
| Yoast SEO | Planned | Different meta keys |
| Classic Editor | Planned | Simple HTML |

### Shortcode Patterns to Strip

```typescript
const SHORTCODE_PATTERNS = [
  // Elementor
  /\[elementor-template[^\]]*\]/g,
  /\[\/elementor-template\]/g,

  // WPBakery
  /\[vc_row[^\]]*\]/g,
  /\[\/vc_row\]/g,
  /\[vc_column[^\]]*\]/g,
  /\[\/vc_column\]/g,
  /\[vc_column_text[^\]]*\]/g,
  /\[\/vc_column_text\]/g,

  // Generic shortcodes
  /\[\/?[a-zA-Z_][a-zA-Z0-9_-]*(?:\s[^\]]*)?]/g,
];
```

---

## Phase 3: Semantic Matching (BlogSnippet)

### Current State
`BlogSnippet.tsx` shows hardcoded mock data on product pages.

### Target State
Show semantically relevant blog posts based on product content using vector embeddings.

### Implementation

1. **Enable pgvector**:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE products ADD COLUMN content_embedding vector(768);
ALTER TABLE blog_posts ADD COLUMN content_embedding vector(768);
```

2. **Generate embeddings** using Gemini text-embedding-004

3. **Create matching function**:
```sql
CREATE FUNCTION match_blog_to_product(
  product_embedding vector(768),
  match_threshold float,
  match_count int
) RETURNS TABLE (
  id uuid,
  title text,
  slug text,
  excerpt text,
  featured_image_url text,
  similarity float
) AS $$
  SELECT
    id, title, slug, excerpt, featured_image_url,
    1 - (content_embedding <=> product_embedding) as similarity
  FROM blog_posts
  WHERE status = 'published'
    AND 1 - (content_embedding <=> product_embedding) > match_threshold
  ORDER BY content_embedding <=> product_embedding
  LIMIT match_count;
$$ LANGUAGE sql;
```

---

## Learnings & Best Practices

### What Worked Well
_To be documented during migration_

### What Didn't Work
_To be documented during migration_

### Performance Optimizations
_To be documented during migration_

### Security Considerations
- Sanitize all imported HTML content
- Validate image MIME types before upload
- Rate limit import API
- Scan for malicious content in uploads

---

## Metrics to Track

- Import success rate
- Average posts per import
- Common failure reasons
- Time to complete import
- Post-import edit rate (how many need manual fixes)

---

## Future Enhancements

- [ ] Support Medium export format
- [ ] Support Substack export
- [ ] Support Ghost export
- [ ] AI-powered content enhancement during import
- [ ] Automatic internal link insertion
- [ ] Duplicate detection across imports
- [ ] Schedule imports for large files
- [ ] Webhook notifications on completion

---

## Phase 4: Blogger App (Standalone Product)

### Vision

A standalone blogging platform where users can:
1. **Migrate from WordPress** - Upload export, blog ready in minutes
2. **Write with zero friction** - Paste text, add images, publish
3. **Auto SEO optimization** - All technical SEO handled on backend

**Tagline**: "Your blog, optimized and live in minutes."

### Target Users
- WordPress users frustrated with complexity
- Small businesses needing a simple blog
- Content creators who want to focus on writing, not tech
- Merchants already on Baci (integrated experience)

---

### Existing Blog Infrastructure

**Database Tables** (already exist in Baci):

| Table | Purpose |
|-------|---------|
| `blog_posts` | 28 columns including SEO fields, content_embedding for semantic matching |
| `blog_categories` | Category management with parent/child relationships |
| `ai_generated_topics` | AI topic suggestions for content planning |

**Already Implemented**:
- JSON-LD schema (BlogPosting, BreadcrumbList)
- Social sharing (Twitter, LinkedIn, Facebook)
- Related posts section
- Category filtering & pagination
- Template-based blog layouts
- RSS feed generation
- View count tracking
- TipTap rich text editor

---

### Auto-Optimization Engine

**On paste/import, automatically optimize:**

1. **Heading Semantics**
   - Ensure single H1 (post title)
   - Convert multiple H1s to H2s
   - Ensure logical hierarchy (H2 → H3 → H4)

2. **Image Optimization**
   - Add alt text if missing (AI-generated)
   - Convert to AVIF/WebP
   - Add lazy loading & dimensions

3. **SEO Meta Generation**
   - Generate title (50-60 chars)
   - Generate meta description (150-160 chars)
   - Identify focus keyword
   - Calculate reading time

4. **Internal Linking**
   - Find mentions of topics in other posts
   - Add contextual links (max 3-5 per post)
   - Link to related products if merchant

5. **Schema Markup**
   - BlogPosting schema (auto)
   - FAQPage schema (if Q&A detected)
   - HowTo schema (if instructions detected)

---

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Blogger App Frontend                         │
│                     blog.usebaci.com                             │
└─────────────────────┬───────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   Import Flow    Editor      Dashboard
        │             │             │
        └─────────────┼─────────────┘
                      ▼
         Auto-Optimization Layer
                      │
                      ▼
              Supabase Backend
                      │
                      ▼
              CDN / Storage
```

---

### WordPress Import UX

**Step 1: Upload**
- Drag & drop WordPress export (.xml or .zip)
- Supports: Elementor, WPBakery, Gutenberg
- SEO: Rank Math, Yoast, AIOSEO

**Step 2: Processing (Auto)**
- Extract posts, categories, tags
- Optimize images → CDN
- Generate SEO metadata
- Add internal links

**Step 3: Review**
- Posts imported count
- Images migrated count
- SEO score average
- Posts needing attention
- Bulk publish option

---

### Simple Editor Design

**Principles:**
- Zero configuration required
- No visible SEO fields (auto-generated)
- Focus on writing, not formatting
- Mobile-first

**Features:**
- Featured image upload
- Title field
- TipTap content editor
- Category & tags
- Collapsible SEO preview (shows auto-generated meta)

---

### Files to Create

| File | Purpose |
|------|---------|
| `src/app/blogger/page.tsx` | Blogger landing page |
| `src/app/blogger/import/page.tsx` | WordPress import flow |
| `src/app/blogger/write/page.tsx` | Simple editor |
| `src/app/blogger/posts/page.tsx` | Posts management |
| `src/app/api/blogger/import/route.ts` | Handle WordPress import |
| `src/app/api/blogger/optimize/route.ts` | Auto-optimization endpoint |
| `src/lib/blog-optimizer.ts` | Optimization engine |
| `src/components/blogger/SimpleEditor.tsx` | Minimal TipTap editor |
| `src/components/blogger/ImportWizard.tsx` | Import flow UI |

---

### Integration Paths

**For Baci Merchants:**
- Blog at `{store}.usebaci.com/blog`
- Same database tables
- BlogSnippet on product pages
- Unified dashboard

**For Standalone Blogger Users:**
- Blog at `{username}.blog.usebaci.com`
- Same optimization engine
- Can upgrade to full store later

---

### Monetization

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | 5 posts/month, basic optimization, subdomain |
| Pro | $9/mo | Unlimited posts, custom domain, advanced SEO |
| Business | $29/mo | Team collaboration, API access, priority support |

---

### Implementation Priority

| Phase | Scope | Timeline |
|-------|-------|----------|
| A: MVP | Simple editor, basic optimization, subdomain hosting | Week 1-2 |
| B: Import | WordPress XML parser, image migration, bulk import | Week 3-4 |
| C: Advanced | ZIP support, shortcode stripping, SEO plugin extraction | Week 5-6 |
| D: Polish | Custom domains, analytics, team features | Week 7-8 |
