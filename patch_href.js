const fs = require('fs');
const file = 'apps/web/src/components/storefront/ogabassey/layout/navbar.tsx';
let content = fs.readFileSync(file, 'utf8');

// The original cast is to `/${string}` inside the backticks, but the problem reported by CodeQL is about unescaped characters because the href is an expression evaluating to a string, then cast to string. Actually, the issue is that it's doing:
// href={`${storeSlug || ''}/account` as `/${string}`}
// For Next.js `<Link>`, if `storeSlug` doesn't have a leading slash, this might be a relative path, and Next.js `<Link href={...}>` in React expects a valid URL. However, the exact error from CodeQL is "[DOM text] is reinterpreted as HTML without escaping meta-characters." Wait, Next.js `<Link>` shouldn't give this CodeQL error unless the `href` prop isn't what's generating it.

// Let's replace the `as \`/${string}\`` with a cleaner approach. If we just wrap it with the `asRoute` helper we already have.
// We saw `import { asRoute } from '@/lib/routes';` in the imports!
// Let's use `asRoute` which returns a `Route` type.

content = content.replace(/href=\{`\$\{storeSlug \|\| ''\}\/account` as `\/\$\{string\}`\}/g, "href={asRoute(`${storeSlug || ''}/account`)}");
content = content.replace(/href=\{`\$\{storeSlug \|\| ''\}\/cart` as `\/\$\{string\}`\}/g, "href={asRoute(`${storeSlug || ''}/cart`)}");
content = content.replace(/href=\{`\$\{storeSlug \|\| ''\}\/\$\{cat.slug\}` as `\/\$\{string\}`\}/g, "href={asRoute(`${storeSlug || ''}/${cat.slug}`)}");
content = content.replace(/href=\{`\$\{storeSlug \|\| ''\}\/imei-check` as `\/\$\{string\}`\}/g, "href={asRoute(`${storeSlug || ''}/imei-check`)}");
content = content.replace(/href=\{`\$\{storeSlug \|\| ''\}\/repairs` as `\/\$\{string\}`\}/g, "href={asRoute(`${storeSlug || ''}/repairs`)}");
content = content.replace(/href=\{`\$\{storeSlug \|\| ''\}\/wallet` as `\/\$\{string\}`\}/g, "href={asRoute(`${storeSlug || ''}/wallet`)}");
content = content.replace(/href=\{`\$\{storeSlug \|\| ''\}\/blog` as `\/\$\{string\}`\}/g, "href={asRoute(`${storeSlug || ''}/blog`)}");

content = content.replace(/router\.push\(`\$\{storeSlug \|\| ''\}\/blog\?search=\$\{encodeURIComponent\(trimmedQuery\)\}` as `\/\$\{string\}`\)/g, "router.push(asRoute(`${storeSlug || ''}/blog?search=${encodeURIComponent(trimmedQuery)}`))");
content = content.replace(/router\.push\(`\$\{storeSlug \|\| ''\}\/search\?q=\$\{encodeURIComponent\(trimmedQuery\)\}` as `\/\$\{string\}`\)/g, "router.push(asRoute(`${storeSlug || ''}/search?q=${encodeURIComponent(trimmedQuery)}`))");
content = content.replace(/router\.push\(`\$\{storeSlug \|\| ''\}\/blog\?search=\$\{encodeURIComponent\(searchQuery\)\}` as `\/\$\{string\}`\)/g, "router.push(asRoute(`${storeSlug || ''}/blog?search=${encodeURIComponent(searchQuery)}`))");
content = content.replace(/router\.push\(fullUrl as `\/\$\{string\}`\)/g, "router.push(asRoute(fullUrl))");


fs.writeFileSync(file, content);
