import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const seoTabSource = readFileSync(
  path.resolve(
    process.cwd(),
    'src/app/dashboard/blog/[id]/edit/edit-blog-seo-tab.tsx'
  ),
  'utf8'
);

describe('EditBlogSeoTab public runtime boundary', () => {
  it('uses the narrow public root-domain accessor instead of the server environment module', () => {
    expect(seoTabSource).toContain(
      "import { getPublicRootDomain } from '@/lib/blog-public-config';"
    );
    expect(seoTabSource).not.toMatch(/from\s+['"]@\/env['"]/);
  });
});
