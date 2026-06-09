'use client';

import { ArrowLeft, Code2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  SubmissionMethodToggle,
  type SubmissionType,
} from './submission-method-toggle';
import type { RepoState } from './submit-template-repo-input';
import { SubmitTemplateRepoInput } from './submit-template-repo-input';
import { getGitHubUrlError } from './submit-template-repo-input-validation';
import { SubmitTemplateSuccessState } from './submit-template-success-state';
import { ZipSubmissionInput } from './zip-submission-input';

export default function SubmitTemplatePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [formState, setFormState] = useState<{
    fileError: string | null;
    isSubmitting: boolean;
    isSuccess: boolean;
    repoState: RepoState;
    selectedFile: File | null;
    submissionType: SubmissionType;
  }>({
    fileError: null,
    isSubmitting: false,
    isSuccess: false,
    repoState: {
      error: null,
      url: '',
    },
    selectedFile: null,
    submissionType: 'github',
  });
  const {
    fileError,
    isSubmitting,
    isSuccess,
    repoState,
    selectedFile,
    submissionType,
  } = formState;

  useEffect(() => {
    if (!isSuccess) return;

    const timeoutId = window.setTimeout(() => {
      router.push('/template-preview');
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isSuccess, router]);

  const validateGitHubUrl = (url: string): boolean => {
    const error = getGitHubUrlError(url);
    setFormState((current) => ({
      ...current,
      repoState: {
        ...current.repoState,
        error,
      },
    }));
    return !error;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (submissionType === 'github' && !validateGitHubUrl(repoState.url)) {
      toast({
        title: 'Invalid GitHub URL',
        description:
          getGitHubUrlError(repoState.url) ??
          'Please enter a valid GitHub URL.',
        variant: 'destructive',
      });
      return;
    }

    const submissionPayload = new FormData(e.currentTarget);
    if (submissionType === 'zip') {
      if (!selectedFile) {
        const message = 'Please upload a project archive before submitting.';
        setFormState((current) => ({
          ...current,
          fileError: message,
        }));
        toast({
          title: 'Archive required',
          description: message,
          variant: 'destructive',
        });
        return;
      }
      submissionPayload.set('file', selectedFile);
    }

    setFormState((current) => ({ ...current, isSubmitting: true }));

    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      void submissionPayload;

      setFormState((current) => ({
        ...current,
        isSubmitting: false,
        isSuccess: true,
      }));
      toast({
        title: 'Submission Received',
        description:
          "We've received your template. Our team will review it shortly.",
      });
    } catch (error) {
      setFormState((current) => ({
        ...current,
        isSubmitting: false,
        isSuccess: false,
      }));
      toast({
        title: 'Submission failed',
        description:
          error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (isSuccess) {
    return (
      <SubmitTemplateSuccessState
        onReturn={() => router.push('/template-preview')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/template-preview"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-8 transition-colors"
        >
          <ArrowLeft className="size-4 mr-2" />
          Back to Gallery
        </Link>

        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900">
            Submit Your Template
          </h1>
          <p className="mt-2 text-gray-500">
            Share your masterpiece with thousands of Baci merchants.
          </p>
        </div>

        <Card className="shadow-lg border-0 ring-1 ring-gray-200">
          <CardHeader className="space-y-1 pb-8 border-b bg-white/50">
            <CardTitle className="text-xl">Template Details</CardTitle>
            <CardDescription>
              Provide the essential information for our review team.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Template Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="e.g. Noir, Modernist..."
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="version">Version</Label>
                  <Input
                    id="version"
                    name="version"
                    placeholder="1.0.0"
                    pattern="^\d+\.\d+\.\d+$"
                    title="Please use semantic versioning (e.g., 1.0.0)"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">
                  Description (Markdown supported)
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Describe your template's features, ideal industries, and design philosophy..."
                  className="min-h-[120px]"
                  required
                />
              </div>

              {/* Submission Method */}
              <div className="space-y-4">
                <Label>Submission Method</Label>
                <SubmissionMethodToggle
                  value={submissionType}
                  onChange={(value) => {
                    setFormState((current) => ({
                      ...current,
                      fileError: null,
                      submissionType: value,
                    }));
                  }}
                />
              </div>

              {/* Dynamic Input based on selection */}
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
                {submissionType === 'github' ? (
                  <SubmitTemplateRepoInput
                    state={repoState}
                    onChange={(nextRepoState) => {
                      setFormState((current) => ({
                        ...current,
                        repoState: nextRepoState,
                      }));
                    }}
                    onValidate={validateGitHubUrl}
                  />
                ) : (
                  <ZipSubmissionInput
                    error={fileError}
                    file={selectedFile}
                    onFileChange={(file) => {
                      setFormState((current) => ({
                        ...current,
                        fileError: null,
                        selectedFile: file,
                      }));
                    }}
                  />
                )}
              </div>

              <div className="pt-4 flex items-center justify-end gap-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.back()}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-w-[140px]"
                >
                  {isSubmitting ? (
                    <span className="flex items-center">
                      <span className="animate-spin mr-2 size-4 border-2 border-current border-t-transparent rounded-full" />
                      Submitting…
                    </span>
                  ) : (
                    <span className="flex items-center">
                      Submit Template
                      <Code2 className="ml-2 size-4" />
                    </span>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
