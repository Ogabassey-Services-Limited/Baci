import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ensurePermission } from '@/lib/merchant-server';
import { QuizAdminClient } from './quiz-admin-client';

export const metadata: Metadata = {
  title: 'Quiz | Baci Dashboard',
  description: 'Generate merchant quiz topics and questions with Gemma',
};

function isPermissionRedirectError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message === 'Authentication required' ||
    error.message === 'No merchant access' ||
    error.message === 'Forbidden' ||
    error.message.startsWith('Permission denied:')
  );
}

export default async function QuizDashboardPage() {
  try {
    await ensurePermission('marketing', 'edit');
  } catch (error) {
    if (!isPermissionRedirectError(error)) {
      throw error;
    }
    redirect('/dashboard');
  }

  return <QuizAdminClient />;
}
