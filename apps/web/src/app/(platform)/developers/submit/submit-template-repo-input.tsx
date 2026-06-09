'use client';

import { AlertCircle, Github } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface RepoState {
  error: string | null;
  url: string;
}

interface SubmitTemplateRepoInputProps {
  onChange: (state: RepoState) => void;
  onValidate: (url: string) => boolean;
  state: RepoState;
}

const INVALID_GITHUB_URL_ERROR =
  'Please enter a valid GitHub URL (e.g., https://github.com/username/repo)';

// GitHub URL validation pattern: https://github.com/username/repo (with optional .git suffix)
const GITHUB_URL_PATTERN = /^https:\/\/github\.com\/[\w-]+\/[\w.-]+(?:\.git)?$/;

export function getGitHubUrlError(url: string): string | null {
  if (!url) return null;
  return GITHUB_URL_PATTERN.test(url) ? null : INVALID_GITHUB_URL_ERROR;
}

export function SubmitTemplateRepoInput({
  onChange,
  onValidate,
  state,
}: SubmitTemplateRepoInputProps) {
  return (
    <div className="space-y-3">
      <Label htmlFor="repo" className="text-gray-700">
        Repository URL
      </Label>
      <div className="relative">
        <Github className="absolute left-3 top-3 size-4 text-gray-400" />
        <Input
          id="repo"
          name="repo"
          type="url"
          value={state.url}
          onChange={(e) => {
            onChange({
              url: e.target.value,
              error: null,
            });
          }}
          onBlur={(e) => {
            onValidate(e.target.value);
          }}
          placeholder="https://github.com/username/baci-template"
          className={cn(
            'pl-9 bg-white',
            state.error && 'border-red-500 focus-visible:ring-red-500'
          )}
          required
          aria-invalid={!!state.error}
          aria-describedby={state.error ? 'repo-error' : undefined}
        />
      </div>
      {state.error ? (
        <p
          id="repo-error"
          className="text-xs text-red-600 flex items-center"
          role="alert"
        >
          <AlertCircle className="size-3 mr-1" />
          {state.error}
        </p>
      ) : (
        <p className="text-xs text-gray-500 flex items-center">
          <AlertCircle className="size-3 mr-1" />
          Make sure the repository is public or you've invited @baci-bot
        </p>
      )}
    </div>
  );
}
