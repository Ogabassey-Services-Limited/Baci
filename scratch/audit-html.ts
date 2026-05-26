import { parse } from 'node-html-parser'; // node-html-parser might not be installed, so we can use a basic regex or standard string parses for safety, or check if we can import it.
// Let's use simple regex-based or manual string-searching parsers for maximum robustness so we don't depend on npm packages that might not be in the root workspace!

async function auditHtml() {
  const url = 'https://ogabassey.com';
  console.log(`Fetching HTML of ${url} for technical SEO audit...`);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) {
      throw new Error(
        `Failed to fetch ${url}: ${res.status} ${res.statusText}`
      );
    }

    const html = await res.text();
    console.log(`\nSuccessfully fetched HTML (${html.length} characters)`);

    // 1. Title Tag
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : null;
    console.log(`\n[Title Tag]:`);
    if (title) {
      console.log(`- Content: "${title}"`);
      console.log(`- Length: ${title.length} chars (Target: 50-60 chars)`);
      if (title.length > 60)
        console.log(
          `  ⚠️ WARNING: Title tag exceeds 60 characters and may be truncated by search engines.`
        );
      if (title.length < 30)
        console.log(
          `  ⚠️ WARNING: Title tag is quite short, consider adding primary keywords or your brand name.`
        );
    } else {
      console.log(`- ❌ MISSING: No title tag found!`);
    }

    // 2. Meta Description
    const descMatch =
      html.match(
        /<meta[^>]+name=["']description["'][^>]*content=["']([\s\S]*?)["']/i
      ) ||
      html.match(
        /<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["']/i
      );
    const desc = descMatch ? descMatch[1].trim() : null;
    console.log(`\n[Meta Description]:`);
    if (desc) {
      console.log(`- Content: "${desc}"`);
      console.log(`- Length: ${desc.length} chars (Target: 150-160 chars)`);
      if (desc.length > 160)
        console.log(
          `  ⚠️ WARNING: Meta description exceeds 160 characters and may be truncated.`
        );
      if (desc.length < 120)
        console.log(
          `  ⚠️ WARNING: Meta description is very short, add a strong call-to-action or keywords.`
        );
    } else {
      console.log(`- ❌ MISSING: No meta description found!`);
    }

    // 3. Canonical Tag
    const canonicalMatch =
      html.match(
        /<link[^>]+rel=["']canonical["'][^>]*href=["']([\s\S]*?)["']/i
      ) ||
      html.match(
        /<link[^>]+href=["']([\s\S]*?)["'][^>]+rel=["']canonical["']/i
      );
    const canonical = canonicalMatch ? canonicalMatch[1].trim() : null;
    console.log(`\n[Canonical URL]:`);
    if (canonical) {
      console.log(`- Content: "${canonical}"`);
      if (canonical !== url && canonical !== `${url}/`) {
        console.log(
          `  ⚠️ NOTE: Canonical URL ("${canonical}") points to a different origin or path than audited ("${url}").`
        );
      } else {
        console.log(
          `  ✅ PASS: Self-referencing canonical URL is correctly set.`
        );
      }
    } else {
      console.log(`- ❌ MISSING: No canonical link found!`);
    }

    // 4. Viewport tag
    const viewportMatch =
      html.match(
        /<meta[^>]+name=["']viewport["'][^>]*content=["']([\s\S]*?)["']/i
      ) ||
      html.match(
        /<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']viewport["']/i
      );
    console.log(`\n[Viewport Tag]:`);
    if (viewportMatch) {
      console.log(`- Content: "${viewportMatch[1]}"`);
      if (viewportMatch[1].includes('width=device-width')) {
        console.log(`  ✅ PASS: Viewport configuration is mobile-responsive.`);
      } else {
        console.log(
          `  ⚠️ WARNING: Viewport might not be configured optimally for mobile.`
        );
      }
    } else {
      console.log(`- ❌ MISSING: No viewport meta tag found!`);
    }

    // 5. Headings Structure (h1-h3)
    console.log(`\n[Heading Structure]:`);
    const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) =>
      m[1].replace(/<[^>]*>/g, '').trim()
    );
    const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) =>
      m[1].replace(/<[^>]*>/g, '').trim()
    );
    const h3s = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)].map((m) =>
      m[1].replace(/<[^>]*>/g, '').trim()
    );

    console.log(`- H1 count: ${h1s.length}`);
    h1s.forEach((h, idx) => console.log(`  * H1 #${idx + 1}: "${h}"`));
    if (h1s.length === 0) {
      console.log(
        `  ❌ FAIL: The page must have exactly one <h1> tag for standard SEO.`
      );
    } else if (h1s.length > 1) {
      console.log(
        `  ⚠️ WARNING: Multiple <h1> tags found. Best practice is to have exactly one primary <h1> per page.`
      );
    } else {
      console.log(`  ✅ PASS: Exactly one primary <h1> tag is present.`);
    }

    console.log(`- H2 count: ${h2s.length}`);
    h2s
      .slice(0, 5)
      .forEach((h, idx) => console.log(`  * H2 #${idx + 1}: "${h}"`));
    if (h2s.length > 5)
      console.log(`  ... and ${h2s.length - 5} more H2 tags.`);

    console.log(`- H3 count: ${h3s.length}`);
    h3s
      .slice(0, 5)
      .forEach((h, idx) => console.log(`  * H3 #${idx + 1}: "${h}"`));
    if (h3s.length > 5)
      console.log(`  ... and ${h3s.length - 5} more H3 tags.`);

    // 6. Structured Data (JSON-LD)
    console.log(`\n[Structured Data (JSON-LD)]:`);
    const jsonLdMatches = [
      ...html.matchAll(
        /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
      ),
    ];
    console.log(`- JSON-LD blocks found: ${jsonLdMatches.length}`);

    jsonLdMatches.forEach((m, idx) => {
      try {
        const cleanedText = m[1].trim();
        const parsed = JSON.parse(cleanedText);
        console.log(
          `  * Block #${idx + 1} Type: ${parsed['@type'] || parsed.type || 'unknown'}`
        );
        if (parsed['@context'])
          console.log(`    Context: ${parsed['@context']}`);
        if (parsed.name) console.log(`    Name: "${parsed.name}"`);
        if (parsed.headline) console.log(`    Headline: "${parsed.headline}"`);
      } catch (err) {
        console.log(
          `  * Block #${idx + 1} ❌ FAILED TO PARSE JSON:`,
          err.message
        );
      }
    });

    if (jsonLdMatches.length === 0) {
      console.log(
        `  ⚠️ WARNING: No schema.org JSON-LD structured data block found on the home page.`
      );
    }

    // 7. Robots.txt analysis
    console.log(`\n[Robots.txt Analysis]:`);
    try {
      const robotsRes = await fetch(`${url}/robots.txt`);
      if (robotsRes.ok) {
        const robotsText = await robotsRes.text();
        console.log(
          `- robots.txt fetched successfully. Content:\n---\n${robotsText.trim()}\n---`
        );
        if (robotsText.toLowerCase().includes('sitemap:')) {
          console.log(
            `  ✅ PASS: Sitemap is explicitly declared in robots.txt.`
          );
        } else {
          console.log(`  ⚠️ WARNING: Sitemap is not declared in robots.txt.`);
        }
      } else {
        console.log(
          `- ❌ FAIL: robots.txt returned status ${robotsRes.status}`
        );
      }
    } catch (err) {
      console.log(`- ❌ FAIL: Could not fetch robots.txt:`, err.message);
    }
  } catch (error: any) {
    console.error(`Error auditing HTML for ${url}:`, error.message || error);
  }
}

auditHtml().catch(console.error);
