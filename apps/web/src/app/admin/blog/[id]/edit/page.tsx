import { BlogEditorClient } from '@/app/admin/blog/blog-editor-client';

type EditAdminBlogPostPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditAdminBlogPostPage({
  params,
}: EditAdminBlogPostPageProps) {
  const { id } = await params;
  return <BlogEditorClient mode="edit" postId={id} />;
}
