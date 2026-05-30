'use client';

import { Loader2 } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SubmitButtonProps extends Omit<ButtonProps, 'type'> {
  /** Text to show while form is submitting */
  pendingText?: string;
  /** Icon to show after text (hidden during pending) */
  icon?: React.ReactNode;
  /** Icon to show during pending state (defaults to Loader2) */
  pendingIcon?: React.ReactNode;
}

/**
 * A submit button that automatically shows loading state when form is submitting.
 * Uses React 19's useFormStatus hook for progressive enhancement.
 *
 * Must be used inside a <form> element that uses a server action.
 *
 * @example
 * ```tsx
 * <form action={myServerAction}>
 *   <input name="email" />
 *   <SubmitButton pendingText="Submitting...">
 *     Submit
 *   </SubmitButton>
 * </form>
 * ```
 */
export function SubmitButton({
  children,
  pendingText,
  icon,
  pendingIcon,
  disabled,
  className,
  onClick,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  const isDisabled = pending || disabled;
  const nativeDisabled = disabled === true && !pending;
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    onClick?.(event);
  };

  return (
    <Button
      type="submit"
      disabled={nativeDisabled}
      aria-disabled={isDisabled}
      aria-busy={pending}
      onClick={handleClick}
      className={cn(
        'aria-disabled:pointer-events-none aria-disabled:opacity-50',
        className
      )}
      {...props}
    >
      {pending ? (
        <>
          {pendingIcon || <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {pendingText || children}
        </>
      ) : (
        <>
          {children}
          {icon}
        </>
      )}
    </Button>
  );
}
