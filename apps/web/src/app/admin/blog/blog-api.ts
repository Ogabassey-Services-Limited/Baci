import { fetchWithCsrf } from '@/lib/api-client';
import type {
  PlatformAdminBlogFormState,
  PlatformAdminBlogPostDetail,
  PlatformAdminBlogPostSummary,
} from './blog-types';

type PlatformBlogListResponse = {
  posts: PlatformAdminBlogPostSummary[];
};

async function readErrorMessage(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: string;
      message?: string;
    };
    return payload.error || payload.message || fallback;
  } catch {
    return fallback;
  }
}

function toApiPayload(
  input: PlatformAdminBlogFormState,
  {
    clearEmptyToNull = false,
    includeFeaturedImageFields = true,
  }: {
    clearEmptyToNull?: boolean;
    includeFeaturedImageFields?: boolean;
  } = {}
) {
  const toOptionalString = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }

    return clearEmptyToNull ? null : undefined;
  };

  const payload = {
    author_name: input.author_name,
    category: toOptionalString(input.category),
    content: input.content,
    excerpt: toOptionalString(input.excerpt),
    featured_image_alt: toOptionalString(input.featured_image_alt),
    seo_description: toOptionalString(input.seo_description),
    seo_title: toOptionalString(input.seo_title),
    slug: input.slug || undefined,
    status: input.status,
    tags: input.tags,
    title: input.title,
  };

  if (!includeFeaturedImageFields) {
    return payload;
  }

  return {
    ...payload,
    featured_image_height: input.featured_image_height,
    featured_image_url: toOptionalString(input.featured_image_url) || null,
    featured_image_variants: input.featured_image_variants,
    featured_image_width: input.featured_image_width,
  };
}

function normalizeTrimmedString(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function areVariantMapsEqual(
  left: Record<string, unknown> | null | undefined,
  right: Record<string, unknown> | null | undefined
): boolean {
  const leftEntries = Object.entries(left ?? {}).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const rightEntries = Object.entries(right ?? {}).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  if (leftEntries.length !== rightEntries.length) {
    return false;
  }

  for (let index = 0; index < leftEntries.length; index += 1) {
    const [leftKey, leftValue] = leftEntries[index];
    const [rightKey, rightValue] = rightEntries[index];
    if (leftKey !== rightKey || leftValue !== rightValue) {
      return false;
    }
  }

  return true;
}

function shouldIncludeFeaturedImageFields(
  input: PlatformAdminBlogFormState,
  existingPost?: PlatformAdminBlogPostDetail | null
): boolean {
  if (!existingPost) {
    return true;
  }

  if (
    normalizeTrimmedString(input.featured_image_url) !==
    normalizeTrimmedString(existingPost.featured_image_url)
  ) {
    return true;
  }

  if (
    (input.featured_image_width ?? null) !==
      (existingPost.featured_image_width ?? null) ||
    (input.featured_image_height ?? null) !==
      (existingPost.featured_image_height ?? null)
  ) {
    return true;
  }

  return !areVariantMapsEqual(
    input.featured_image_variants,
    existingPost.featured_image_variants
  );
}

export async function listPlatformBlogPosts(): Promise<
  PlatformAdminBlogPostSummary[]
> {
  const response = await fetch('/api/admin/blog/posts?limit=100&offset=0', {
    cache: 'no-store',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, 'Failed to load platform blog posts')
    );
  }

  const payload = (await response.json()) as PlatformBlogListResponse;
  return payload.posts || [];
}

export async function getPlatformBlogPost(
  id: string
): Promise<PlatformAdminBlogPostDetail> {
  const response = await fetch(`/api/admin/blog/posts/${id}`, {
    cache: 'no-store',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Failed to load post'));
  }

  return response.json();
}

export async function createPlatformBlogPost(
  input: PlatformAdminBlogFormState
): Promise<PlatformAdminBlogPostDetail> {
  const response = await fetchWithCsrf('/api/admin/blog/posts', {
    body: JSON.stringify(toApiPayload(input)),
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Failed to create post'));
  }

  return response.json();
}

export async function updatePlatformBlogPost(
  id: string,
  input: PlatformAdminBlogFormState,
  existingPost?: PlatformAdminBlogPostDetail | null
): Promise<PlatformAdminBlogPostDetail> {
  const includeFeaturedImageFields = shouldIncludeFeaturedImageFields(
    input,
    existingPost
  );
  const response = await fetchWithCsrf(`/api/admin/blog/posts/${id}`, {
    body: JSON.stringify(
      toApiPayload(input, {
        clearEmptyToNull: true,
        includeFeaturedImageFields,
      })
    ),
    method: 'PATCH',
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Failed to update post'));
  }

  return response.json();
}

export async function deletePlatformBlogPost(id: string): Promise<void> {
  const response = await fetchWithCsrf(`/api/admin/blog/posts/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Failed to delete post'));
  }
}
