import type { BlogPost } from './blog-client-types';

export function getBlogStatusToast(status: BlogPost['status']) {
  return {
    description: `The blog post has been ${status === 'published' ? 'published' : status === 'archived' ? 'archived' : 'moved to drafts'}.`,
    title:
      status === 'published'
        ? 'Post Published'
        : status === 'archived'
          ? 'Post Archived'
          : 'Post Unpublished',
  };
}
