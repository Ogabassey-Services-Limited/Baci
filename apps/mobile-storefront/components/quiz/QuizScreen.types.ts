import type { QuizIntegrityTier } from '@/services/quiz';

export interface QuizScreenProps {
  integrityTier?: QuizIntegrityTier;
  locale?: string;
  onSignIn?: () => void;
}
