import { useState } from 'react';
import { useDebounce } from '@/hooks';

interface UseSearchDropdownStateInput {
  externalQuery?: string;
  onExternalQueryChange?: (text: string) => void;
}

interface UseSearchDropdownStateResult {
  activeQuery: string;
  effectiveQuery: string;
  isControlled: boolean;
  setInternalQuery: (value: string) => void;
  setQuery: (value: string) => void;
}

export function useSearchDropdownState({
  externalQuery,
  onExternalQueryChange,
}: UseSearchDropdownStateInput): UseSearchDropdownStateResult {
  const [internalQuery, setInternalQuery] = useState('');
  const isControlled = externalQuery !== undefined;
  const activeQuery = isControlled ? externalQuery : internalQuery;
  const debouncedQuery = useDebounce(activeQuery, 300);
  const effectiveQuery = debouncedQuery.trim();
  const setQuery = onExternalQueryChange ?? setInternalQuery;

  return {
    activeQuery,
    effectiveQuery,
    isControlled,
    setInternalQuery,
    setQuery,
  };
}
