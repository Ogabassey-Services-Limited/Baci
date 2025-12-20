# Technical SEO Audit Checklist

Complete technical audit framework based on Koray GÜBÜR's Cost of Retrieval principle.

## Table of Contents
1. [Critical Numbers](#critical-numbers)
2. [Cost of Retrieval Optimization](#cost-of-retrieval-optimization)
3. [Crawl Budget Formula](#crawl-budget-formula)
4. [Ranking State Assessment](#ranking-state-assessment)
5. [Crawl Optimization](#crawl-optimization)
6. [Core Web Vitals](#core-web-vitals)
7. [Site Architecture](#site-architecture)
8. [Structured Data](#structured-data)

## Critical Numbers

| Metric | Koray's Specification |
|--------|----------------------|
| HTML page size | **<450KB** |
| Server response time | **<100ms** |
| Internal links per page | **Maximum 10** |
| Content similarity between pages | **<6%** |
| Update to trigger re-ranking | **30%+ of content** |
| Crawl hits on canonical URLs | **99%** |
| 200/304 status codes | **99%** |

## Cost of Retrieval Optimization

**Formula:** Cost of Retrieval = (Crawl + Understand + Evaluate + Index + Rank + Serve) / Value

**Goal:** Minimize cost, maximize value.

### Byte-cost Factors:
- [ ] HTML size **<450KB**
- [ ] Images compressed and properly sized (WebP)
- [ ] CSS/JS minified and bundled
- [ ] Unnecessary code removed
- [ ] Efficient HTML structure

### Time-cost Factors:
- [ ] Server response time **<100ms TTFB**
- [ ] CDN implemented for static assets
- [ ] Caching headers configured
- [ ] Database queries optimized
- [ ] No render-blocking resources

### Value Signals:
- [ ] Unique, comprehensive content
- [ ] Clear entity coverage
- [ ] Satisfies search intent
- [ ] Quality Node status

## Crawl Budget Formula

**Crawl Budget = Crawl Rate Limit × Crawl Demand**

### Crawl Rate Limit (determined by):
- Website performance
- Server speed
- GSC settings

### Crawl Demand (determined by):
- Popularity
- Loss of Topicality (freshness need)

### Optimization Targets:
- [ ] **99% HTML crawl hits** on canonical URLs
- [ ] **99% 200/304 status codes**
- [ ] Minimize 404/410/5xx responses
- [ ] Eliminate redirect chains

## Ranking State Assessment

### Check Current State:

**Google Search Console Indicators:**
- Pages: Valid vs Excluded ratio
- "Indexed, not submitted in sitemap" pages
- "Crawled - currently not indexed" pages
- "Discovered - currently not indexed" pages

**Negative Ranking State Signs:**
- [ ] High % of "Crawled - currently not indexed"
- [ ] Declining crawl frequency
- [ ] New content not ranking despite quality
- [ ] Impressions without clicks

**Positive Ranking State Signs:**
- [ ] Most submitted pages indexed
- [ ] Stable or increasing crawl frequency
- [ ] New content ranking within 2-4 weeks
- [ ] Healthy impressions-to-clicks ratio

### Fixing Negative Ranking State:

1. **Reduce Page Count**
   - [ ] Audit all pages for value
   - [ ] Remove/noindex thin content
   - [ ] Consolidate duplicate topics
   - [ ] 410 permanently removed pages

2. **Improve Response Time**
   - [ ] Upgrade hosting if needed
   - [ ] Implement caching
   - [ ] Optimize database
   - [ ] Use CDN

3. **Clean Non-Ranking Documents**
   - [ ] Identify pages with 0 impressions (6+ months)
   - [ ] Either improve or remove
   - [ ] Redirect valuable URLs

4. **Optimize Internal Linking**
   - [ ] Reduce to ~15 links per page
   - [ ] Remove site-wide footer link spam
   - [ ] Increase contextual link quality

## Crawl Optimization

### Robots.txt:
- [ ] Allows important pages
- [ ] Blocks admin/login areas
- [ ] Blocks search results pages
- [ ] Blocks parameter duplicates
- [ ] Points to sitemap(s)
- [ ] No accidental disallows

### XML Sitemaps:
- [ ] Split by content type
- [ ] Only 200 status URLs
- [ ] Accurate lastmod dates
- [ ] <50MB / <50,000 URLs per file
- [ ] Submitted in Search Console
- [ ] Updated when content changes

### Crawl Budget:
**Efficiency Ratio:** Total Indexed Pages / Daily Crawl Rate
- Healthy: <10
- Concerning: 10-50
- Critical: >50

### Canonicalization:
- [ ] Self-referencing canonicals on all unique pages
- [ ] No conflicting canonical signals
- [ ] Cross-domain canonicals where needed
- [ ] Canonical + redirect consistency

### URL Cleanliness:
- [ ] Descriptive, keyword-relevant URLs
- [ ] Lowercase only
- [ ] Hyphens for word separation
- [ ] No unnecessary parameters
- [ ] Logical hierarchy in path
- [ ] No session IDs in URLs

### Ranking Signal Dilution Prevention:
- [ ] No duplicate content across URLs
- [ ] Faceted navigation handled (noindex or canonical)
- [ ] Parameter URLs blocked or canonicalized
- [ ] Similar pages consolidated

## Core Web Vitals

### LCP (Largest Contentful Paint) ≤ 2.5s

**Audit:**
- [ ] Identify LCP element (usually hero image or H1)
- [ ] Check image optimization
- [ ] Check server response time
- [ ] Check render-blocking resources

**Fixes:**
- [ ] Preload LCP image
- [ ] Do NOT lazy load above-fold images
- [ ] Optimize image format (WebP)
- [ ] Inline critical CSS
- [ ] Defer non-critical JS

### INP (Interaction to Next Paint) ≤ 200ms

**Audit:**
- [ ] Test main interactions (clicks, taps)
- [ ] Check JavaScript execution time
- [ ] Check DOM size

**Fixes:**
- [ ] Break up long tasks (<50ms chunks)
- [ ] Reduce DOM complexity (<1500 nodes)
- [ ] Optimize event handlers
- [ ] Defer third-party scripts

### CLS (Cumulative Layout Shift) ≤ 0.1

**Audit:**
- [ ] Test page load for visual shifts
- [ ] Check images without dimensions
- [ ] Check dynamic content injection

**Fixes:**
- [ ] Add width/height to all images
- [ ] Reserve space for ads/embeds
- [ ] Use font-display: swap
- [ ] Avoid inserting content above existing content

## Site Architecture

### Hierarchy:
- [ ] Flat structure (≤3 clicks from homepage)
- [ ] Logical category/subcategory organization
- [ ] Clear parent-child relationships
- [ ] No orphan pages

### Navigation:
- [ ] Clear primary navigation
- [ ] Breadcrumbs on all deep pages
- [ ] Footer links to key pages
- [ ] HTML sitemap (optional)

### Internal Linking (Koray's Exact Specifications):

**Maximum 10 links per page:**
- [ ] **5 links** in sidebar (latest articles)
- [ ] **3 contextual links** in main content (I-nodes)
- [ ] **1 link** in footer (homepage)
- [ ] **1 link** in header (homepage)

**Link Node Types (prioritize I-nodes):**
- **I-nodes (Individual)**: Isolated contextual links — **HIGHEST value**
- **C-nodes (Content block)**: Groups of links in content
- **S-nodes (Site-wide)**: Navigation links — lowest value

**Rules:**
- [ ] All contextual links are I-nodes
- [ ] Consistent anchor text per target page
- [ ] No generic anchors ("click here", "read more")
- [ ] Quality Nodes linked from homepage
- [ ] All internal links dofollow
- [ ] **Never use same anchor text for different pages**

### Page Segmentation:
- [ ] >70% unique main content per page
- [ ] Minimal boilerplate
- [ ] Semantic HTML structure
- [ ] Clear content sections

### Semantic HTML:
- [ ] `<main>` wrapping primary content
- [ ] `<article>` for standalone content
- [ ] `<section>` for distinct sections
- [ ] `<nav>` for navigation
- [ ] `<header>` and `<footer>` properly used
- [ ] `<aside>` for secondary content

## Structured Data

### Required for All Sites:
- [ ] Organization schema
- [ ] WebSite schema (with SearchAction if applicable)
- [ ] BreadcrumbList schema

### Content-Type Specific:

**E-commerce:**
- [ ] Product schema (name, price, availability, brand)
- [ ] AggregateRating schema
- [ ] Review schema
- [ ] Offer schema

**Local Business:**
- [ ] LocalBusiness schema
- [ ] GeoCoordinates
- [ ] OpeningHoursSpecification

**Content Sites:**
- [ ] Article schema
- [ ] Author schema
- [ ] FAQ schema (where applicable)

### Implementation Quality:
- [ ] Valid in Rich Results Test
- [ ] No errors in Search Console
- [ ] Matches visible page content
- [ ] All required properties included
- [ ] No spam/misleading markup

## Security & Protocol

- [ ] HTTPS everywhere
- [ ] HSTS header implemented
- [ ] No mixed content
- [ ] Security headers configured
- [ ] No security vulnerabilities

## HTTP Status Codes

**CRITICAL: Use 410, not 404, for permanent deletions.**

410 (Gone) saves crawl budget by signaling "stop crawling this permanently."
404 continues to be recrawled periodically.

- [ ] Zero 5xx errors
- [ ] **410 for permanently deleted content** (not 404)
- [ ] 404 only for content that might return
- [ ] No redirect chains (max 1 redirect)
- [ ] No redirect loops
- [ ] No soft 404s

## Mobile Optimization

- [ ] Mobile-responsive design
- [ ] Mobile-first indexing ready
- [ ] Touch targets ≥48x48px
- [ ] No horizontal scrolling
- [ ] Readable without zooming
- [ ] Mobile usability passing in GSC
