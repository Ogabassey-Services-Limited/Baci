import { redirect } from 'next/navigation';
import { BlogEditorClient } from '@/app/admin/blog/blog-editor-client';
import { getPlatformAdminAuth } from '@/lib/platform-admin-auth';

export default async function NewAdminBlogPostPage() {
  const auth = await getPlatformAdminAuth();
  if (auth.status === 'unauthenticated') {
    redirect('/login?redirect=%2Fadmin');
  }

  if (auth.status === 'forbidden') {
    redirect('/dashboard');
  }

  return <BlogEditorClient mode="create" />;
}
