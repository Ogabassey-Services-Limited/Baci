import { Logo } from '@/components/logo';
import { ThemedCard } from '@/components/themed/themed-card';

export function StaffAcceptFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-primary/5 to-secondary/5 p-4">
      <ThemedCard className="w-full max-w-md p-8 shadow-xl">
        <div className="text-center mb-8">
          <Logo className="mx-auto" />
        </div>
        <output className="block text-center" aria-live="polite">
          <div
            aria-hidden="true"
            className="mx-auto mb-4 size-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
          />
          <h1 className="text-2xl font-bold mb-2">Checking invitation</h1>
          <p className="text-muted-foreground">
            Please wait while we verify your staff invite.
          </p>
        </output>
      </ThemedCard>
    </div>
  );
}
