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
      setInputValue('');
      return;
    }

    if (maxTags && value.length >= maxTags) {
      return;
    }

    onChange([...value, trimmedInput]);
    setInputValue('');
  };

  const removeTag = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder={value.length > 0 ? '' : placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
          disabled={maxTags ? value.length >= maxTags : false}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={addTag}
          disabled={
            !inputValue.trim() || (maxTags ? value.length >= maxTags : false)
          }
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag, index) => (
            <Badge
              key={`${tag}-${index}`}
              variant="secondary"
              className="px-2 py-1 text-sm font-normal"
            >
              {tag}
              <button
                type="button"
                className="ml-2 hover:bg-destructive/20 rounded-full p-0.5 cursor-pointer transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(index);
                }}
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
