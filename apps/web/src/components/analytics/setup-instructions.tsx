'use client';

import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface SetupStep {
  title: string;
  description: string;
  link?: string;
  linkText?: string;
}

interface PlatformInstructions {
  name: string;
  icon: React.ReactNode;
  color: string;
  pixelIdLabel: string;
  pixelIdFormat: string;
  pixelIdExample: string;
  apiTokenLabel?: string;
  apiTokenDescription?: string;
  steps: SetupStep[];
  tips?: string[];
}

const CopyButton = ({
  text,
  'aria-label': ariaLabel,
}: {
  text: string;
  'aria-label'?: string;
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={ariaLabel || 'Copy to clipboard'}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
};

export const platformInstructions: Record<string, PlatformInstructions> = {
  google: {
    name: 'Google Analytics 4',
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M22.84 2.998a2.157 2.157 0 0 0-2.157-2.16 2.157 2.157 0 1 0 0 4.314 2.157 2.157 0 0 0 2.157-2.154zm-2.157 6.312a2.157 2.157 0 0 0-2.157 2.157v10.376a2.157 2.157 0 0 0 4.314 0V11.467a2.157 2.157 0 0 0-2.157-2.157zM7.157 0A7.157 7.157 0 0 0 0 7.157v9.686a7.157 7.157 0 0 0 14.314 0V7.157A7.157 7.157 0 0 0 7.157 0zm2.843 16.843a2.843 2.843 0 1 1-5.686 0V7.157a2.843 2.843 0 0 1 5.686 0v9.686z" />
      </svg>
    ),
    color: 'text-orange-500',
    pixelIdLabel: 'Measurement ID',
    pixelIdFormat: 'G-XXXXXXXXXX',
    pixelIdExample: 'G-ABC123DEF4',
    steps: [
      {
        title: 'Go to Google Analytics',
        description:
          "Sign in to your Google Analytics account or create one if you don't have one.",
        link: 'https://analytics.google.com/',
        linkText: 'Open Google Analytics',
      },
      {
        title: 'Create or select a property',
        description:
          'Click Admin (gear icon) → Create Property, or select an existing GA4 property.',
      },
      {
        title: 'Find your Measurement ID',
        description:
          'Go to Admin → Data Streams → Select your web stream → Copy the Measurement ID (starts with G-).',
      },
      {
        title: 'Paste your Measurement ID',
        description:
          'Enter the Measurement ID in the field above. It should look like: G-ABC123DEF4',
      },
    ],
    tips: [
      "Make sure you're using a GA4 property, not Universal Analytics (UA-)",
      'Enable Enhanced Measurement in Data Streams for automatic event tracking',
      'Your data will appear in GA4 within 24-48 hours',
    ],
  },
  facebook: {
    name: 'Facebook/Meta Pixel',
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
    color: 'text-blue-600',
    pixelIdLabel: 'Pixel ID',
    pixelIdFormat: '15-16 digit number',
    pixelIdExample: '1234567890123456',
    apiTokenLabel: 'Conversions API Token',
    apiTokenDescription: 'For server-side tracking (optional but recommended)',
    steps: [
      {
        title: 'Go to Meta Events Manager',
        description:
          'Sign in to your Meta Business Suite and navigate to Events Manager.',
        link: 'https://business.facebook.com/events_manager',
        linkText: 'Open Events Manager',
      },
      {
        title: 'Create or select a Pixel',
        description:
          'Click "Connect Data Sources" → "Web" → "Meta Pixel" if creating new, or select existing pixel.',
      },
      {
        title: 'Copy your Pixel ID',
        description:
          "Your Pixel ID is shown at the top of the pixel overview page. It's a 15-16 digit number.",
      },
      {
        title: '(Optional) Generate CAPI Token',
        description:
          'For server-side tracking: Go to Settings → Generate Access Token. This helps track conversions even when browsers block cookies.',
      },
    ],
    tips: [
      'Server-side tracking (CAPI) can improve conversion tracking by 10-20%',
      'Test your pixel using the Meta Pixel Helper Chrome extension',
      'Enable Automatic Advanced Matching for better attribution',
    ],
  },
  tiktok: {
    name: 'TikTok Pixel',
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    ),
    color: 'text-black dark:text-white',
    pixelIdLabel: 'Pixel ID',
    pixelIdFormat: 'Alphanumeric code',
    pixelIdExample: 'C1234ABCD5678EFG',
    apiTokenLabel: 'Events API Access Token',
    apiTokenDescription: 'For server-side tracking (optional)',
    steps: [
      {
        title: 'Go to TikTok Ads Manager',
        description:
          'Sign in to TikTok Ads Manager with your business account.',
        link: 'https://ads.tiktok.com/',
        linkText: 'Open TikTok Ads Manager',
      },
      {
        title: 'Navigate to Events',
        description:
          'Click Assets → Events → Web Events. Create a new pixel or select an existing one.',
      },
      {
        title: 'Copy your Pixel ID',
        description:
          "Your Pixel ID is shown in the pixel details. It's an alphanumeric code like C1234ABCD5678EFG.",
      },
      {
        title: '(Optional) Set up Events API',
        description:
          'For server-side tracking: Go to Settings → Generate Access Token in your pixel settings.',
      },
    ],
    tips: [
      'TikTok Pixel tracks video views, clicks, and conversions',
      'Use TikTok Pixel Helper extension to verify installation',
      'Enable Advanced Matching for better audience targeting',
    ],
  },
  snapchat: {
    name: 'Snapchat Pixel',
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.419-.015h.06z" />
      </svg>
    ),
    color: 'text-yellow-400',
    pixelIdLabel: 'Pixel ID',
    pixelIdFormat: 'UUID format',
    pixelIdExample: 'abc12345-6789-def0-1234-567890abcdef',
    apiTokenLabel: 'Conversions API Token',
    apiTokenDescription: 'For server-side tracking (optional)',
    steps: [
      {
        title: 'Go to Snapchat Ads Manager',
        description:
          'Sign in to Snapchat Ads Manager with your business account.',
        link: 'https://ads.snapchat.com/',
        linkText: 'Open Snapchat Ads Manager',
      },
      {
        title: 'Navigate to Events Manager',
        description:
          'Click the menu icon → Events Manager. Create a new Snap Pixel or select an existing one.',
      },
      {
        title: 'Copy your Pixel ID',
        description:
          "Your Pixel ID is shown in the pixel setup. It's a UUID format string.",
      },
      {
        title: '(Optional) Set up CAPI',
        description:
          'For server-side tracking: Generate an API token in your pixel settings under Conversions API.',
      },
    ],
    tips: [
      'Snapchat Pixel works best for targeting younger demographics',
      'Use Snap Pixel Helper to verify your installation',
      'Enable User Properties for better ad targeting',
    ],
  },
  twitter: {
    name: 'Twitter/X Pixel',
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    color: 'text-black dark:text-white',
    pixelIdLabel: 'Pixel ID',
    pixelIdFormat: 'Alphanumeric code',
    pixelIdExample: 'o1234',
    steps: [
      {
        title: 'Go to Twitter Ads',
        description: 'Sign in to Twitter Ads with your business account.',
        link: 'https://ads.twitter.com/',
        linkText: 'Open Twitter Ads',
      },
      {
        title: 'Navigate to Events Manager',
        description:
          'Click Tools → Events Manager → Add event source → Install with pixel code.',
      },
      {
        title: 'Copy your Pixel ID',
        description:
          "Your Pixel ID is shown in the installation code snippet. Look for the ID after \"twq('config','\".",
      },
      {
        title: 'Set up conversion events',
        description:
          'Define which events (purchase, sign up, etc.) you want to track in Events Manager.',
      },
    ],
    tips: [
      'Twitter Pixel helps optimize ad campaigns based on website actions',
      'Use the Twitter Pixel Helper extension to verify installation',
      'Set up conversion tracking for better campaign optimization',
    ],
  },
};

interface SetupInstructionsProps {
  platform: keyof typeof platformInstructions;
  className?: string;
}

export function SetupInstructions({
  platform,
  className,
}: SetupInstructionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const instructions = platformInstructions[platform];

  if (!instructions) return null;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn('mt-2', className)}
    >
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground hover:text-foreground p-0 h-auto"
        >
          {isOpen ? (
            <>
              Hide setup instructions <ChevronUp className="w-3 h-3 ml-1" />
            </>
          ) : (
            <>
              How to find your {instructions.pixelIdLabel}?{' '}
              <ChevronDown className="w-3 h-3 ml-1" />
            </>
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className={instructions.color}>{instructions.icon}</span>
            <h4 className="font-medium">{instructions.name} Setup</h4>
          </div>

          <div className="space-y-3">
            {instructions.steps.map((step, index) => (
              <div key={step.title} className="flex gap-3">
                <div className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center">
                  {index + 1}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {step.description}
                  </p>
                  {step.link && (
                    <a
                      href={step.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      {step.linkText || 'Learn more'}{' '}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Expected format:</span>{' '}
              <code className="bg-muted px-1 py-0.5 rounded">
                {instructions.pixelIdFormat}
              </code>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="font-medium">Example:</span>{' '}
              <code className="bg-muted px-1 py-0.5 rounded">
                {instructions.pixelIdExample}
              </code>
              <CopyButton
                text={instructions.pixelIdExample}
                aria-label="Copy example format"
              />
            </p>
          </div>

          {instructions.tips && instructions.tips.length > 0 && (
            <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-xs">
                <strong className="block mb-1">Pro Tips:</strong>
                <ul className="list-disc list-inside space-y-0.5">
                  {instructions.tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
