# Diagnostic Questions Framework

Structured questions to diagnose SEO issues and identify growth opportunities.

## Table of Contents
1. [Initial Assessment Questions](#initial-assessment-questions)
2. [Ranking State Diagnosis](#ranking-state-diagnosis)
3. [Topical Authority Diagnosis](#topical-authority-diagnosis)
4. [Content Quality Diagnosis](#content-quality-diagnosis)
5. [Technical Health Diagnosis](#technical-health-diagnosis)
6. [Growth Opportunity Identification](#growth-opportunity-identification)

## Initial Assessment Questions

### About the Site:
1. What is the site's primary purpose/business model?
2. What is the Source Context (why should this brand exist in SERPs)?
3. What is the Central Entity the site revolves around?
4. Who is the target audience?
5. What are the primary conversion goals?

### Current Performance:
1. What is the current monthly organic traffic?
2. What is the traffic trend (growing, declining, flat)?
3. What are the top 10 performing pages?
4. What are the top 10 performing queries?
5. Any recent algorithm update impacts?

### Historical Context:
1. How old is the domain?
2. When was the last major content update?
3. Any major site changes in past 12 months?
4. Any manual actions or security issues?
5. Publishing frequency and consistency?

## Ranking State Diagnosis

### Search Console Analysis:

**Index Coverage Questions:**
1. What % of submitted pages are indexed?
   - >90% = Healthy
   - 70-90% = Needs attention
   - <70% = Critical issues

2. How many "Crawled - currently not indexed" pages?
   - If high: Quality threshold issues

3. How many "Discovered - currently not indexed" pages?
   - If high: Crawl budget or priority issues

4. Are important pages in "Excluded" for any reason?

**Crawl Stats Questions:**
1. Is crawl frequency stable, increasing, or decreasing?
   - Decreasing = Negative ranking state signal

2. What is the average response time during crawls?
   - >500ms = Problem

3. What types of files are being crawled? (HTML vs resources)

**Performance Questions:**
1. Impressions trend over 6 months?
2. Clicks trend over 6 months?
3. CTR average and trend?
4. Average position trend?

### Ranking State Verdict:

**Positive State if:**
- Crawl frequency stable/increasing
- >90% index rate
- New content ranks within weeks
- Impressions and clicks growing

**Negative State if:**
- Crawl frequency declining
- Many "Crawled not indexed" pages
- New content not ranking
- Impressions without corresponding clicks

## Topical Authority Diagnosis

### Coverage Assessment:

1. **Central Entity Clarity:**
   - Is there a clear central entity?
   - Does all content relate to it?
   - Any content outside topical borders?

2. **Topic Completeness:**
   - Are all primary entity attributes covered?
   - Are related entities covered?
   - Any obvious topical gaps?

3. **Query Coverage:**
   - What % of relevant queries does the site rank for?
   - Are there high-value queries with no coverage?
   - Are there queries with coverage but poor rankings?

4. **Content Network:**
   - Do pages interlink semantically?
   - Are there contextual bridges between topics?
   - Any orphan pages or isolated clusters?

### Authority Signals:

1. **Quality Nodes:**
   - Does site have comprehensive anchor content?
   - Are Quality Nodes linked from homepage?
   - Are they truly "best on internet" quality?

2. **Historical Data:**
   - How long has site been publishing on topic?
   - Is publishing consistent or sporadic?
   - Content freshness and update frequency?

3. **External Signals:**
   - Brand search demand (trend)?
   - Mentions across web?
   - Backlink profile relevant to topic?

## Content Quality Diagnosis

### Page-Level Analysis:

For each underperforming page, ask:

1. **Intent Match:**
   - Does content match search intent?
   - Is the format appropriate (list, guide, product, etc.)?
   - Does it satisfy the query completely?

2. **Information Quality:**
   - Is information accurate and current?
   - Any contradictory statements?
   - Are claims supported by evidence/sources?

3. **Entity Clarity:**
   - Are entities clearly named?
   - Are attributes explicitly stated?
   - Are values specific (numbers, facts)?

4. **Unique Value:**
   - What does this page offer that competitors don't?
   - Any original insights, data, or media?
   - Is it "best on internet" for this query?

5. **Technical Execution:**
   - Proper heading hierarchy?
   - Semantic HTML structure?
   - Schema markup implemented?

### Content Network Analysis:

1. **Internal Linking:**
   - Is page linked from relevant content?
   - Does it link to related content?
   - Is anchor text descriptive?

2. **Topical Positioning:**
   - Where does page fit in topical map?
   - Is it core or outer section?
   - Does it support Quality Nodes?

## Technical Health Diagnosis

### Priority Issue Checklist:

**Critical (Fix Immediately):**
- [ ] Any 5xx server errors?
- [ ] HTTPS issues?
- [ ] Mobile usability errors?
- [ ] Core Web Vitals failing (field data)?
- [ ] Security issues?
- [ ] Manual actions?

**High Priority:**
- [ ] Redirect chains?
- [ ] Orphan pages?
- [ ] Duplicate content?
- [ ] Slow server response?
- [ ] Broken internal links?

**Medium Priority:**
- [ ] Missing structured data?
- [ ] Suboptimal URL structure?
- [ ] Excessive internal links?
- [ ] Image optimization?
- [ ] Missing meta descriptions?

### Performance Analysis:

1. **Speed:**
   - What is real-user LCP?
   - What is real-user INP?
   - What is real-user CLS?
   - What is TTFB?

2. **Crawlability:**
   - Are important pages being crawled?
   - Is crawl budget being wasted?
   - Any crawl errors?

3. **Indexability:**
   - Are important pages indexed?
   - Any indexing issues?
   - Canonical tag issues?

## Growth Opportunity Identification

### Quick Wins:

1. **Pages ranking 4-10:**
   - Which pages are close to page 1?
   - What would push them up? (content depth, links, freshness)

2. **High impressions, low clicks:**
   - Which pages get seen but not clicked?
   - Title/description improvements needed?

3. **Competitor gaps:**
   - What do competitors rank for that you don't?
   - Which are achievable targets?

### Strategic Opportunities:

1. **Topical expansion:**
   - What related topics could build authority?
   - What outer section topics are missing?

2. **Format opportunities:**
   - Any topics better served by different format?
   - Video, infographic, tool opportunities?

3. **New entity coverage:**
   - Any new products, trends, entities to cover?
   - Seasonal or timely opportunities?

### Priority Matrix:

| Opportunity | Effort | Impact | Priority |
|-------------|--------|--------|----------|
| Fix technical issues | Low | High | 1 |
| Improve ranking 4-10 pages | Medium | High | 2 |
| Fill obvious topical gaps | Medium | High | 3 |
| Create Quality Nodes | High | High | 4 |
| Expand outer section | High | Medium | 5 |

## Diagnosis Output Template

```
SITE AUDIT SUMMARY

Domain: [domain]
Date: [date]

1. RANKING STATE: [Positive/Negative/Mixed]
   Key indicators:
   - [indicator 1]
   - [indicator 2]
   - [indicator 3]

2. TOPICAL AUTHORITY STATUS:
   Coverage: [%]
   Quality Nodes: [Yes/No, count]
   Historical Data: [Strong/Weak]
   
3. CRITICAL ISSUES:
   - [Issue 1] — [Fix]
   - [Issue 2] — [Fix]
   
4. HIGH PRIORITY RECOMMENDATIONS:
   - [Recommendation 1]
   - [Recommendation 2]
   
5. GROWTH OPPORTUNITIES:
   - [Opportunity 1] — Expected impact: [X]
   - [Opportunity 2] — Expected impact: [X]

6. 30/60/90 DAY PLAN:
   30 Days: [Focus area]
   60 Days: [Focus area]
   90 Days: [Focus area]
```
