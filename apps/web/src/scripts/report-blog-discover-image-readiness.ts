import 'dotenv/config';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { generateFeaturedImageVariants } from '@/lib/blog-featured-image-variants';
import {
  validateBlogDiscoverImageReadiness,
  type BlogDiscoverImageReadinessCode,
} from '@/lib/blog-discover-readiness';
import { extractManagedBlogStoragePath } from '@/lib/blog-managed-storage-paths';
import { createServiceClient } from '@/lib/supabase/service';

export type ReportFormat = 'json' | 'csv';

export type ReportStatusReason =
  | 'missing_featured_image'
  | 'unmanaged_featured_image'
  | 'dimensions_too_small'
  | 'missing_landscape_variant'
  | 'variant_not_managed'
  | 'variant_invalid'
  | 'legacy_missing_metadata';

export type BlogDiscoverReadinessScanRow = {
  id: string;
  merchant_id: string;
  slug: string;
  status: string | null;
  featured_image_url: string | null;
  featured_image_width: number | null;
  featured_image_height: number | null;
  featured_image_variants: Record<string, unknown> | null;
};

export type BlogDiscoverReadinessReportRow = {
  merchantId: string;
  merchantSlug: string;
  postId: string;
  postSlug: string;
  statusReason: ReportStatusReason;
  featuredImageHost: string;
  managedPathRecoverable: boolean;
};

type ParsedArgs = {
  format: ReportFormat;
  merchant: string | null;
  batchSize: number;
  reprocessManaged: boolean;
};

type ParseResult = { ok: true; args: ParsedArgs } | { ok: false; error: string };

const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 500;

function parseReasonFromReadiness(
  code: BlogDiscoverImageReadinessCode,
  details: Record<string, unknown>
): ReportStatusReason {
  if (code === 'BLOG_FEATURED_IMAGE_NOT_MANAGED') {
    return 'unmanaged_featured_image';
  }
  if (code === 'BLOG_FEATURED_IMAGE_VARIANT_MISSING') {
    return 'missing_landscape_variant';
  }
  if (code === 'BLOG_FEATURED_IMAGE_VARIANT_NOT_MANAGED') {
    return 'variant_not_managed';
  }
  if (code === 'BLOG_FEATURED_IMAGE_VARIANTS_INVALID') {
    return 'variant_invalid';
  }
  if (details.reason === 'missing_featured_image') {
    return 'missing_featured_image';
  }
  if (details.reason === 'dimensions_too_small') {
    return 'dimensions_too_small';
  }
  return 'legacy_missing_metadata';
}

function getUrlHost(url: string | null): string {
  if (!url) {
    return '';
  }

  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

function inferMimeTypeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'avif') return 'image/avif';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export function parseReportBlogDiscoverReadinessArgs(
  argv: readonly string[]
): ParseResult {
  const args: ParsedArgs = {
    format: 'json',
    merchant: null,
    batchSize: DEFAULT_BATCH_SIZE,
    reprocessManaged: false,
  };

  for (const rawArg of argv) {
    if (rawArg === '--reprocess-managed') {
      args.reprocessManaged = true;
      continue;
    }

    if (rawArg.startsWith('--format=')) {
      const format = rawArg.slice('--format='.length).trim();
      if (format !== 'json' && format !== 'csv') {
        return { ok: false, error: `Invalid format "${format}"` };
      }
      args.format = format;
      continue;
    }

    if (rawArg.startsWith('--merchant=')) {
      const merchant = rawArg.slice('--merchant='.length).trim();
      if (!merchant) {
        return { ok: false, error: 'Merchant filter cannot be empty' };
      }
      args.merchant = merchant;
      continue;
    }

    if (rawArg.startsWith('--batch-size=')) {
      const parsed = Number.parseInt(
        rawArg.slice('--batch-size='.length).trim(),
        10
      );
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_BATCH_SIZE) {
        return {
          ok: false,
          error: `Batch size must be between 1 and ${MAX_BATCH_SIZE}`,
        };
      }
      args.batchSize = parsed;
      continue;
    }

    return { ok: false, error: `Unknown argument "${rawArg}"` };
  }

  return { ok: true, args };
}

export function buildBlogDiscoverReadinessRows(
  posts: BlogDiscoverReadinessScanRow[],
  merchantSlugById: ReadonlyMap<string, string>
): BlogDiscoverReadinessReportRow[] {
  const rows: BlogDiscoverReadinessReportRow[] = [];

  for (const post of posts) {
    if (post.status !== 'published') {
      continue;
    }

    const readiness = validateBlogDiscoverImageReadiness(post, post.merchant_id);
    if (readiness.ready) {
      continue;
    }

    rows.push({
      merchantId: post.merchant_id,
      merchantSlug: merchantSlugById.get(post.merchant_id) ?? '',
      postId: post.id,
      postSlug: post.slug,
      statusReason: parseReasonFromReadiness(
        readiness.code,
        readiness.details ?? {}
      ),
      featuredImageHost: getUrlHost(post.featured_image_url),
      managedPathRecoverable:
        extractManagedBlogStoragePath(
          post.featured_image_url ?? '',
          post.merchant_id
        ) !== null,
    });
  }

  return rows;
}

export function toBlogDiscoverReadinessCsv(
  rows: BlogDiscoverReadinessReportRow[]
): string {
  const header =
    'merchant_id,merchant_slug,post_id,post_slug,status_reason,featured_image_host,managed_path_recoverable';

  const lines = rows.map((row) =>
    [
      row.merchantId,
      row.merchantSlug,
      row.postId,
      row.postSlug,
      row.statusReason,
      row.featuredImageHost,
      row.managedPathRecoverable ? 'true' : 'false',
    ]
      .map(escapeCsv)
      .join(',')
  );

  return [header, ...lines].join('\n');
}

async function maybeResolveMerchantId(
  merchantFilter: string | null
): Promise<string | null> {
  if (!merchantFilter) {
    return null;
  }

  const supabase = createServiceClient();
  const byId = await supabase
    .from('merchants')
    .select('id, slug')
    .eq('id', merchantFilter);

  const idRow = Array.isArray(byId.data) ? byId.data[0] : byId.data;
  if (idRow?.id) {
    return idRow.id;
  }

  const bySlug = await supabase
    .from('merchants')
    .select('id, slug')
    .eq('slug', merchantFilter);
  const slugRow = Array.isArray(bySlug.data) ? bySlug.data[0] : bySlug.data;
  return slugRow?.id ?? null;
}

async function reprocessManagedRows(
  rows: BlogDiscoverReadinessReportRow[],
  postsById: ReadonlyMap<string, BlogDiscoverReadinessScanRow>
): Promise<number> {
  let updated = 0;
  const supabase = createServiceClient();

  for (const row of rows) {
    if (!row.managedPathRecoverable) continue;
    if (
      ![
        'legacy_missing_metadata',
        'missing_landscape_variant',
        'dimensions_too_small',
      ].includes(row.statusReason)
    ) {
      continue;
    }

    const post = postsById.get(row.postId);
    if (!post?.featured_image_url) continue;

    const sourcePath = extractManagedBlogStoragePath(
      post.featured_image_url,
      post.merchant_id
    );
    if (!sourcePath) continue;

    const sourceFile = await supabase.storage.from('media').download(sourcePath);
    if (sourceFile.error || !sourceFile.data) continue;

    const sourceBuffer = Buffer.from(await sourceFile.data.arrayBuffer());
    let generated: Awaited<ReturnType<typeof generateFeaturedImageVariants>>;
    try {
      generated = await generateFeaturedImageVariants(sourceBuffer, {
        mimeType: sourceFile.data.type || inferMimeTypeFromPath(sourcePath),
      });
    } catch {
      continue;
    }

    const originalName = sourcePath.split('/')[2] ?? '';
    const token = originalName.replace(/\.[a-zA-Z0-9]+$/, '');
    if (!token) continue;

    const variants: Record<string, string> = {};
    let uploadFailed = false;
    for (const variant of Object.values(generated.variants)) {
      const variantPath = `${post.merchant_id}/blog/${token}/${variant.key}.webp`;
      const uploaded = await supabase.storage.from('media').upload(
        variantPath,
        variant.buffer,
        {
          contentType: variant.contentType,
          upsert: true,
        }
      );
      if (uploaded.error) {
        uploadFailed = true;
        break;
      }
      variants[variant.key] = supabase.storage
        .from('media')
        .getPublicUrl(variantPath).data.publicUrl;
    }
    if (uploadFailed) continue;

    const updateResult = await supabase
      .from('blog_posts')
      .update({
        featured_image_width: generated.source.width,
        featured_image_height: generated.source.height,
        featured_image_variants: variants,
      })
      .eq('id', post.id);

    if (!updateResult.error) {
      updated += 1;
    }
  }

  return updated;
}

export async function runReportBlogDiscoverImageReadinessCli(
  argv: readonly string[]
): Promise<number> {
  const parsed = parseReportBlogDiscoverReadinessArgs(argv);
  if (!parsed.ok) {
    console.error(parsed.error);
    return 1;
  }

  const merchantId = await maybeResolveMerchantId(parsed.args.merchant);
  if (parsed.args.merchant && !merchantId) {
    console.error(`Merchant not found: ${parsed.args.merchant}`);
    return 1;
  }

  const supabase = createServiceClient();
  let postsQuery = supabase
    .from('blog_posts')
    .select(
      'id, merchant_id, slug, status, featured_image_url, featured_image_width, featured_image_height, featured_image_variants'
    )
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .order('updated_at', { ascending: false });

  if (merchantId) {
    postsQuery = postsQuery.eq('merchant_id', merchantId);
  }

  const { data: posts, error: postsError } = await postsQuery.range(
    0,
    parsed.args.batchSize - 1
  );
  if (postsError) {
    console.error(postsError.message);
    return 1;
  }

  const typedPosts = (posts ?? []) as BlogDiscoverReadinessScanRow[];
  const merchantIds = [...new Set(typedPosts.map((post) => post.merchant_id))];
  const merchantSlugById = new Map<string, string>();

  if (merchantIds.length > 0) {
    const { data: merchants } = await supabase
      .from('merchants')
      .select('id, slug')
      .in('id', merchantIds);
    for (const merchant of merchants ?? []) {
      if (merchant.id && merchant.slug) {
        merchantSlugById.set(merchant.id, merchant.slug);
      }
    }
  }

  const rows = buildBlogDiscoverReadinessRows(typedPosts, merchantSlugById);
  const postsById = new Map(typedPosts.map((post) => [post.id, post]));
  const reprocessedCount = parsed.args.reprocessManaged
    ? await reprocessManagedRows(rows, postsById)
    : 0;

  if (parsed.args.format === 'csv') {
    console.log(toBlogDiscoverReadinessCsv(rows));
  } else {
    console.log(
      JSON.stringify(
        {
          scanned: typedPosts.length,
          flagged: rows.length,
          reprocessed: reprocessedCount,
          rows,
        },
        null,
        2
      )
    );
  }

  return 0;
}

const currentFile = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;

if (import.meta.url === currentFile) {
  runReportBlogDiscoverImageReadinessCli(process.argv.slice(2))
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.stack || error.message : error);
      process.exitCode = 1;
    });
}
