'use client';

import dynamic from 'next/dynamic';
import type { JSONContent } from 'novel';
import { useCallback, useState } from 'react';

// Dynamically import NovelEditor to avoid SSR issues with Tiptap
const NovelEditor = dynamic(() => import('./novel-editor'), {
  ssr: false,
});

interface Product {
  id: string;
  name: string;
  price: number;
  compare_at_price?: number;
  images: string[];
  slug: string;
  status: string;
}

interface BlogEditorProps {
  content: string; // Used for initial content only in this new version
  onChange: (content: string) => void;
  placeholder?: string;
  onImageUpload?: (file: File) => Promise<string>;
  onProductsChange?: (products: Product[]) => void;
  embeddedProducts?: Product[];
  showProductEmbed?: boolean;
}

export function BlogEditor({
  content,
  onChange,
  onImageUpload,
  onProductsChange,
  embeddedProducts = [],
}: BlogEditorProps) {
  const [initialContent] = useState<JSONContent | string | undefined>(() => {
    if (!content) return undefined;
    try {
      // Attempt to parse existing content as JSON if it's stored correctly
      if (content.trim().startsWith('{')) {
        return JSON.parse(content);
      }
      // Fallback: If it's HTML, pass it as string. Novel/Tiptap will parse it.
      return content;
    } catch {
      // If parsing fails, assuming it is plain text/HTML
      return content;
    }
  });

  // Handle JSON content updates from Novel
  const handleContentChange = useCallback(
    (json: JSONContent) => {
      // We store the JSON stringified as the 'content' in the DB
      // This allows re-hydration later
      onChange(JSON.stringify(json));
    },
    [onChange]
  );

  return (
    <div className="min-h-[500px] w-full">
      <NovelEditor
        initialValue={initialContent}
        onChange={handleContentChange}
        onImageUpload={onImageUpload}
        onProductsChange={onProductsChange}
        embeddedProducts={embeddedProducts}
      />
    </div>
  );
}
