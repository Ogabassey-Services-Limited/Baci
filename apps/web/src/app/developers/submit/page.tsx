'use client';

import '@/app/globals.css';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Code2,
  Github,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
import { cn } from '@/lib/utils';

type SubmissionType = 'github' | 'zip';

// GitHub URL validation pattern: https://github.com/username/repo (with optional .git suffix)
const GITHUB_URL_PATTERN = /^https:\/\/github\.com\/[\w-]+\/[\w.-]+(?:\.git)?$/;

export default function SubmitTemplatePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [submissionType, setSubmissionType] =
    useState<SubmissionType>('github');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [repoError, setRepoError] = useState<string | null>(null);

  const validateGitHubUrl = (url: string): boolean => {
    if (!url) return true; // Don't show error for empty (required will handle it)
    if (!GITHUB_URL_PATTERN.test(url)) {
      setRepoError(
        'Please enter a valid GitHub URL (e.g., https://github.com/username/repo)'
      );
      return false;
    }
    setRepoError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate GitHub URL if that submission type is selected
    if (submissionType === 'github' && !validateGitHubUrl(repoUrl)) {
      return;
    }

    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setIsSubmitting(false);
    setIsSuccess(true);

    toast({
      title: 'Submission Received',
      description:
        "We've received your template. Our team will review it shortly.",
    });

    // Redirect after delay
    setTimeout(() => {
      router.push('/template-preview');
    }, 3000);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8 shadow-xl border-green-100">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Submission Successful!
          </h2>
          <p className="text-gray-500 mb-8">
            Thank you for contributing to the Baci ecosystem. Your template is
            now in our review queue.
          </p>
          <Button
            onClick={() => router.push('/template-preview')}
            className="w-full"
          >
            Return to Gallery
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/template-preview"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
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
              {/* Basic Info */}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setSubmissionType('github')}
                    className={cn(
                      'flex items-center justify-center p-4 border rounded-xl transition-all duration-200',
                      submissionType === 'github'
                        ? 'border-blue-600 bg-blue-50/50 text-blue-700 ring-1 ring-blue-600'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    <Github className="w-5 h-5 mr-3" />
                    <span className="font-medium">GitHub Repository</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubmissionType('zip')}
                    className={cn(
                      'flex items-center justify-center p-4 border rounded-xl transition-all duration-200',
                      submissionType === 'zip'
                        ? 'border-blue-600 bg-blue-50/50 text-blue-700 ring-1 ring-blue-600'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    <Upload className="w-5 h-5 mr-3" />
                    <span className="font-medium">Upload Zip Archive</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Input based on selection */}
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
                {submissionType === 'github' ? (
                  <div className="space-y-3">
                    <Label htmlFor="repo" className="text-gray-700">
                      Repository URL
                    </Label>
                    <div className="relative">
                      <Github className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="repo"
                        name="repo"
                        type="url"
                        value={repoUrl}
                        onChange={(e) => {
                          setRepoUrl(e.target.value);
                          if (repoError) setRepoError(null); // Clear error on edit
                        }}
                        onBlur={(e) => validateGitHubUrl(e.target.value)}
                        placeholder="https://github.com/username/baci-template"
                        className={cn(
                          'pl-9 bg-white',
                          repoError &&
                            'border-red-500 focus-visible:ring-red-500'
                        )}
                        required
                        aria-invalid={!!repoError}
                        aria-describedby={repoError ? 'repo-error' : undefined}
                      />
                    </div>
                    {repoError ? (
                      <p
                        id="repo-error"
                        className="text-xs text-red-600 flex items-center"
                        role="alert"
                      >
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {repoError}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 flex items-center">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Make sure the repository is public or you've invited
                        @baci-bot
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Label htmlFor="file" className="text-gray-700">
                      Project Archive
                    </Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-white hover:bg-gray-50/50 transition-colors cursor-pointer">
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-900">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        ZIP, TAR up to 50MB
                      </p>
                      <Input id="file" type="file" className="hidden" />
                    </div>
                  </div>
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
                      <span className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                      Submitting...
                    </span>
                  ) : (
                    <span className="flex items-center">
                      Submit Template
                      <Code2 className="ml-2 w-4 h-4" />
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
