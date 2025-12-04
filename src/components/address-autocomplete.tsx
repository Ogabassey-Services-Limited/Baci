'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Home, Loader2, MapPin, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { ThemedInput } from '@/components/themed';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  getPlaceDetails,
  getPlacePredictions,
  generateSessionToken,
  type PlacePrediction
} from '@/lib/google-places';

export interface PlaceDetails {
  streetNumber: string;
  route: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  formattedAddress: string;
}

interface AddressAutocompleteProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onSelect'> {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement> | string) => void;
  onSelect?: (place: PlaceDetails) => void;
  useThemedInput?: boolean;
  showIcon?: boolean;
  country?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  useThemedInput = false,
  showIcon = false,
  country,
  className,
  ...props
}: AddressAutocompleteProps) {
  // Internal state for input value if not controlled
  const [internalValue, setInternalValue] = useState(value || '');

  // Sync internal value with prop
  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);

  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [sessionToken, setSessionToken] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Initialize session token
  useEffect(() => {
    setSessionToken(generateSessionToken());
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);

    // Call parent onChange
    if (onChange) {
      onChange(e);
    }

    setIsOpen(true);
    setHighlightedIndex(-1);

    // Debounce API call
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (newValue.length < 2) {
      setPredictions([]);
      return;
    }

    setIsLoading(true);
    debounceTimer.current = setTimeout(async () => {
      try {
        const results = await getPlacePredictions(newValue, sessionToken, country);
        setPredictions(results);
      } catch (error) {
        console.error('Error fetching predictions:', error);
      } finally {
        setIsLoading(false);
      }
    }, 300);
  };

  const handleClear = () => {
    setInternalValue('');
    setPredictions([]);
    setIsOpen(false);
    if (onChange) {
      // Create a synthetic event to clear the parent form
      const event = {
        target: { value: '' }
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(event);
    }
    inputRef.current?.focus();
  };

  const handlePredictionSelect = async (prediction: PlacePrediction) => {
    // Update input with main text
    setInternalValue(prediction.mainText);

    // Notify parent of text change
    if (onChange) {
      onChange(prediction.mainText);
    }

    setIsOpen(false);
    setIsLoading(true);

    try {
      const details = await getPlaceDetails(prediction.placeId, sessionToken);

      if (details && onSelect) {
        onSelect({
          streetNumber: details.streetNumber || '',
          route: details.route || '',
          city: details.city || '',
          state: details.state || '',
          zip: details.postalCode || '',
          country: details.country || '',
          formattedAddress: details.formattedAddress,
        });
      }

      // Refresh session token
      setSessionToken(generateSessionToken());

    } catch (error) {
      console.error('Error fetching place details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || predictions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < predictions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : predictions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handlePredictionSelect(predictions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const InputComponent = useThemedInput ? ThemedInput : Input;

  return (
    <div className="relative group">
      {showIcon && (
        <Home className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-[var(--store-primary)] transition-colors duration-200 z-10" />
      )}
      <InputComponent
        {...props}
        ref={inputRef}
        value={internalValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsOpen(true)}
        className={cn(
          showIcon ? 'pl-10' : '',
          'pr-10 transition-all duration-200',
          className
        )}
        autoComplete="off"
      />

      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
        {internalValue && !isLoading && (
          <button
            type="button"
            onClick={handleClear}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear address"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {isLoading && (
          <Loader2 className="h-4 w-4 animate-spin text-[var(--store-primary)]" />
        )}
      </div>

      {/* Custom Dropdown */}
      <AnimatePresence>
        {isOpen && predictions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            ref={dropdownRef}
            className="absolute z-50 w-full mt-2 bg-popover/95 backdrop-blur-sm border rounded-xl shadow-xl max-h-[300px] overflow-auto overflow-x-hidden"
          >
            <div className="p-1.5 space-y-0.5">
              {predictions.map((prediction, index) => (
                <button
                  key={prediction.placeId}
                  type="button"
                  className={cn(
                    'w-full px-3 py-2.5 text-left text-sm rounded-lg transition-colors flex items-start gap-3 group/item',
                    highlightedIndex === index
                      ? 'bg-[var(--store-primary)]/10 text-foreground'
                      : 'hover:bg-accent hover:text-accent-foreground'
                  )}
                  onClick={() => handlePredictionSelect(prediction)}
                >
                  <div className={cn(
                    "mt-0.5 p-1.5 rounded-full bg-muted transition-colors",
                    highlightedIndex === index
                      ? "bg-[var(--store-primary)]/20 text-[var(--store-primary)]"
                      : "group-hover/item:bg-background"
                  )}>
                    <MapPin className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "font-medium truncate transition-colors",
                      highlightedIndex === index ? "text-[var(--store-primary)]" : ""
                    )}>
                      {prediction.mainText}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {prediction.secondaryText}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <div className="px-4 py-2 border-t bg-muted/30 flex justify-end sticky bottom-0 backdrop-blur-md">
              <img
                src="https://developers.google.com/static/maps/documentation/images/powered_by_google_on_white.png"
                alt="Powered by Google"
                className="h-4 object-contain opacity-60 grayscale hover:grayscale-0 transition-all duration-300"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
