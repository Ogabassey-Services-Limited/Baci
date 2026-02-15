'use client';

import { Plus, X } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface TagInputProps {
  placeholder?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  className?: string;
  maxTags?: number;
}

export function TagInput({
  placeholder = 'Type and press Enter...',
  value = [],
  onChange,
  className,
  maxTags,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [announcement, setAnnouncement] = useState('');

  // Flash announcement pattern: ensures screen reader re-announces identical sequential messages
  const flashAnnouncement = (msg: string) => {
    setAnnouncement('');
    // Schedule before next paint to ensure DOM change is detected between empty and message strings
    requestAnimationFrame(() => {
      setAnnouncement(msg);
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeTag(value.length - 1);
    }
  };

  const addTag = () => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput) return;

    if (value.includes(trimmedInput)) {
      flashAnnouncement(`Tag "${trimmedInput}" has already been added`);
      setInputValue('');
      return;
    }

    if (maxTags && value.length >= maxTags) {
      flashAnnouncement(`Maximum of ${maxTags} tags reached`);
      return;
    }

    onChange([...value, trimmedInput]);
    setAnnouncement(`Tag "${trimmedInput}" added`);
    setInputValue('');
  };

  const removeTag = (index: number) => {
    const removedTag = value[index];
    onChange(value.filter((_, i) => i !== index));
    flashAnnouncement(`Tag "${removedTag}" removed`);
  };

  return (
    <div className={cn('space-y-2', className)}>
      {/* Screen reader announcements */}
      <output className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </output>

      <div className="flex gap-2">
        <Input
          type="text"
          placeholder={value.length > 0 ? '' : placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
          disabled={maxTags ? value.length >= maxTags : false}
          aria-label="Tag input"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={addTag}
          disabled={
            !inputValue.trim() || (maxTags ? value.length >= maxTags : false)
          }
          aria-label="Add tag"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag, index) => (
            <Badge
              // biome-ignore lint/suspicious/noArrayIndexKey: Order doesn't matter for display
              key={`${tag}-${index}`}
              variant="secondary"
              className="px-2 py-1 text-sm font-normal"
            >
              {tag}
              <button
                type="button"
                className="ml-2 hover:bg-destructive/20 rounded-full p-0.5 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(index);
                }}
                aria-label={`Remove ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
