'use client';

import { useEffect, useRef, useState } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { useMerchantFeatures } from '@/hooks/use-merchant-features';
import { useToast } from '@/hooks/use-toast';
import { getPreviewUrl } from './actions';
import {
  updateCountsForDeletion,
  updateCountsForStatus,
} from './blog-client-counts';
import { blogClientDerivedState } from './blog-client-derived-state';
import { blogClientRequests } from './blog-client-requests';
import type {
  BlogCounts,
  BlogPost,
  UseBlogClientStateOptions,
} from './blog-client-types';
import { createBlogStatusMutationCoordinator as createStatusCoordinator } from './blog-status-mutation-coordinator';
import { getBlogStatusToast } from './blog-status-toast';
import { useBlogMerchantSession } from './use-blog-merchant-session';

export function useBlogClientState({
  initialCounts,
  initialPosts,
  merchant,
  useInitialData = initialPosts.length > 0 || initialCounts !== undefined,
}: UseBlogClientStateOptions) {
  const { toast } = useToast();
  const { autoBlogEnabled } = useMerchantFeatures(merchant.id);
  const [posts, setPosts] = useState(initialPosts);
  const [isLoading, setIsLoading] = useState(!useInitialData);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(
    () => (initialCounts?.total ?? 0) > initialPosts.length
  );
  const [statsData, setStatsData] = useState<BlogCounts | null | undefined>(
    initialCounts
  );
  const [initialMerchantId] = useState(merchant.id);
  const initialDataConsumedRef = useRef(false);
  const merchantSessionRef = useBlogMerchantSession(merchant.id);
  const [statusMutationCoordinator] = useState(() =>
    createStatusCoordinator<BlogPost>()
  );
  const [previousMerchantId, setPreviousMerchantId] = useState(merchant.id);
  const shouldUseInitialData =
    useInitialData &&
    merchant.id === initialMerchantId &&
    statusFilter === 'all' &&
    debouncedSearch === '' &&
    page === 1;

  const queryKey = `${merchant.id}|${statusFilter}|${debouncedSearch}|${page}`;
  const [prevQueryKey, setPrevQueryKey] = useState(queryKey);
  if (merchant.id !== previousMerchantId) {
    setPreviousMerchantId(merchant.id);
    setPosts([]);
    setStatsData(undefined);
    setHasMore(false);
    setDeletePostId(null);
    setPage(1);
    setIsLoading(true);
  }
  if (queryKey !== prevQueryKey) {
    setPrevQueryKey(queryKey);
    setIsLoading(true);
  }

  useEffect(() => {
    let isStale = false;
    if (shouldUseInitialData && !initialDataConsumedRef.current) {
      initialDataConsumedRef.current = true;
      return;
    }
    blogClientRequests
      .requestPosts(
        blogClientRequests.buildPostsQuery(
          merchant.id,
          statusFilter,
          debouncedSearch,
          page
        )
      )
      .then((data) => {
        if (isStale) return;
        setPosts(data.posts || []);
        setHasMore(data.hasMore);
        if (data.counts) setStatsData(data.counts);
      })
      .catch((error) => {
        if (isStale) return;
        console.error('Error fetching blog posts:', error);
        toast({
          title: 'Error',
          description: 'Failed to load blog posts.',
          variant: 'destructive',
        });
      })
      .finally(() => {
        if (!isStale) setIsLoading(false);
      });
    return () => {
      isStale = true;
    };
  }, [
    merchant.id,
    statusFilter,
    debouncedSearch,
    page,
    shouldUseInitialData,
    toast,
  ]);

  const selectStatus = (status: string) => {
    setStatusFilter(status);
    setPage(1);
  };
  const changeSearch = (search: string) => {
    setSearchQuery(search);
    setPage(1);
  };
  const showDiscoverRemediation = () => {
    setStatusFilter('published');
    setSearchQuery('');
    setPage(1);
  };
  const previewPost = async (post: BlogPost) => {
    if (!merchant.slug) {
      toast({
        title: 'Error',
        description: 'Merchant slug not found.',
        variant: 'destructive',
      });
      return;
    }
    const previewMerchantSession = merchantSessionRef.current;
    try {
      const previewUrl = await getPreviewUrl(
        merchant.id,
        merchant.slug,
        post.slug
      );
      if (merchantSessionRef.current !== previewMerchantSession) return;
      window.open(previewUrl, '_blank');
    } catch (error) {
      if (merchantSessionRef.current !== previewMerchantSession) return;
      console.error('Error getting preview URL:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate preview link.',
        variant: 'destructive',
      });
    }
  };

  const deletePost = async () => {
    if (!deletePostId) return;
    const previousPosts = [...posts];
    const idToDelete = deletePostId;
    const deletedPost = previousPosts.find((post) => post.id === idToDelete);
    const submittedMerchantSession = merchantSessionRef.current;
    setPosts((current) => current.filter((post) => post.id !== idToDelete));
    if (deletedPost) {
      setStatsData((current) =>
        updateCountsForDeletion(current, deletedPost, -1)
      );
    }
    setDeletePostId(null);
    try {
      await blogClientRequests.requestDeletePost(merchant.id, idToDelete);
      if (merchantSessionRef.current !== submittedMerchantSession) return;
      toast({
        title: 'Post Deleted',
        description: 'The blog post has been permanently deleted.',
      });
    } catch (error) {
      if (merchantSessionRef.current !== submittedMerchantSession) return;
      console.error('Error deleting post:', error);
      setPosts((current) => {
        if (current.some((post) => post.id === idToDelete)) return current;
        const deletedPost = previousPosts.find(
          (post) => post.id === idToDelete
        );
        if (!deletedPost) return current;
        const previousIndex = previousPosts.findIndex(
          (post) => post.id === idToDelete
        );
        return [
          ...current.slice(0, previousIndex),
          deletedPost,
          ...current.slice(previousIndex),
        ];
      });
      if (deletedPost) {
        setStatsData((current) =>
          updateCountsForDeletion(current, deletedPost, 1)
        );
      }
      toast({
        title: 'Error',
        description: 'Failed to delete blog post. The list has been restored.',
        variant: 'destructive',
      });
    }
  };

  const updatePostStatus = async (
    postId: string,
    status: BlogPost['status']
  ) => {
    const previousPost = posts.find((post) => post.id === postId);
    if (!previousPost || previousPost.status === status) return;
    const submittedMerchantSession = merchantSessionRef.current;
    const statusMutationKey = `${submittedMerchantSession.id}:${postId}`;
    setPosts((current) =>
      current.map((post) => (post.id === postId ? { ...post, status } : post))
    );
    setStatsData((current) =>
      updateCountsForStatus(current, previousPost.status, status)
    );
    const statusMutation = statusMutationCoordinator.enqueue(
      statusMutationKey,
      previousPost,
      () =>
        blogClientRequests.requestUpdatePostStatus(
          submittedMerchantSession.id,
          postId,
          status
        )
    );
    const isCurrentStatusMutation = () =>
      merchantSessionRef.current === submittedMerchantSession &&
      statusMutation.isLatest();
    try {
      const updatedPost = await statusMutation.result;
      statusMutation.confirm({ ...statusMutation.confirmed(), ...updatedPost });
      if (!isCurrentStatusMutation()) return;
      setPosts((current) =>
        current.map((post) =>
          post.id === postId ? { ...post, ...updatedPost } : post
        )
      );
      toast(getBlogStatusToast(status));
    } catch (error) {
      if (!isCurrentStatusMutation()) return;
      console.error('Error updating post:', error);
      const confirmedPost = statusMutation.confirmed();
      setPosts((current) =>
        current.map((post) =>
          post.id === postId && post.status === status
            ? { ...post, ...confirmedPost }
            : post
        )
      );
      setStatsData((current) =>
        updateCountsForStatus(current, status, confirmedPost.status)
      );
      toast({
        title: 'Error',
        description: 'Failed to update blog post.',
        variant: 'destructive',
      });
    } finally {
      statusMutation.clear();
    }
  };

  const stats = blogClientDerivedState.getStats(posts, statsData ?? undefined);
  const discoverReadiness = blogClientDerivedState.getDiscoverReadiness(
    posts,
    merchant.id
  );
  return {
    autoBlogEnabled,
    changeSearch,
    deletePost,
    deletePostId,
    discoverReadiness,
    hasMore,
    isLoading,
    page,
    posts,
    previewPost,
    searchQuery,
    selectStatus,
    setDeletePostId,
    setPage,
    showDiscoverRemediation,
    stats,
    statusFilter,
    updatePostStatus,
  };
}
