import { fetchWithCsrf } from '@/lib/api-client';
import type { BlogPost, BlogPostsResponse } from './blog-client-types';

const ITEMS_PER_PAGE = 20;

function buildPostsQuery(
  merchantId: string,
  statusFilter: string,
  search: string,
  page: number
): URLSearchParams {
  const params = new URLSearchParams();
  params.set('merchantId', merchantId);
  if (statusFilter !== 'all') params.set('status', statusFilter);
  if (search) params.set('search', search);
  params.set('limit', ITEMS_PER_PAGE.toString());
  params.set('offset', ((page - 1) * ITEMS_PER_PAGE).toString());
  return params;
}

async function requestPosts(
  params: URLSearchParams
): Promise<BlogPostsResponse> {
  const response = await fetch(`/api/merchant/blog/posts?${params}`);
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(
      errorBody?.error || `Failed to fetch posts (${response.status})`
    );
  }
  return response.json();
}

async function requestDeletePost(
  merchantId: string,
  postId: string
): Promise<void> {
  const response = await fetchWithCsrf(
    `/api/merchant/blog/posts/${postId}?merchantId=${encodeURIComponent(merchantId)}`,
    { method: 'DELETE' }
  );
  if (!response.ok) throw new Error('Failed to delete post');
}

async function requestUpdatePostStatus(
  merchantId: string,
  postId: string,
  status: BlogPost['status']
): Promise<Partial<BlogPost>> {
  const response = await fetchWithCsrf(
    `/api/merchant/blog/posts/${postId}?merchantId=${encodeURIComponent(merchantId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }
  );
  if (!response.ok) throw new Error('Failed to update post');
  return response.json();
}

export const blogClientRequests = {
  buildPostsQuery,
  requestDeletePost,
  requestPosts,
  requestUpdatePostStatus,
};
