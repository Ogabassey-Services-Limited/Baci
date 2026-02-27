'use client';

import { Check, Copy } from 'lucide-react';
import * as React from 'react';

import { Button, type ButtonProps } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface CopyButtonProps extends ButtonProps {
  value: string;
  label?: string;
  successLabel?: string;
}

export function CopyButton({
  value,
  label = 'Copy',
  successLabel = 'Copied!',
  className,
  variant = 'outline',
  size = 'icon',
  onClick,
  ...props
}: CopyButtonProps) {
  const [hasCopied, setHasCopied] = React.useState(false);

  React.useEffect(() => {
    if (hasCopied) {
      const timeout = setTimeout(() => {
        setHasCopied(false);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [hasCopied]);

  const copyToClipboard = async (
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.preventDefault();
    e.stopPropagation(); // Always stop propagation for copy actions

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(value);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = value;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setHasCopied(true);
    } catch {
      // Clipboard write failed — do not show success state
    }

    onClick?.(e);
  };

  const Icon = hasCopied ? Check : Copy;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size={size}
            variant={variant}
            className={cn(
              'relative z-10 transition-all duration-200',
              hasCopied &&
                'text-green-600 border-green-600 bg-green-50 hover:bg-green-100 hover:text-green-700',
              className
            )}
            onClick={copyToClipboard}
            type="button"
            {...props}
          >
            <span className="sr-only">{hasCopied ? successLabel : label}</span>
            <Icon
              className={cn(
                'h-4 w-4',
                hasCopied && 'animate-in zoom-in-50 duration-200'
              )}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{hasCopied ? successLabel : label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
