import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ensurePermission } from '@/lib/merchant-server';
import { QuizAdminClient } from './quiz-admin-client';

export const metadata: Metadata = {
  title: 'Quiz | Baci Dashboard',
  description: 'Generate merchant quiz topics and questions with Gemma',
};

export default async function QuizDashboardPage() {
  try {
    await ensurePermission('marketing', 'view');
  } catch {
    redirect('/dashboard');
  }

  return <QuizAdminClient />;
}
