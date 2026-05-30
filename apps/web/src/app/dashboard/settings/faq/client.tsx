'use client';

import { Loader2, Plus, RefreshCw, Save, Trash2, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { ThemedButton } from '@/components/themed/themed-button';
import { ThemedCard } from '@/components/themed/themed-card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { CachedMerchant } from '@/lib/cached-data';
import { createClient } from '@/lib/supabase/client';
import type { FAQItem } from '@/types/faq';

interface FAQSettingsClientProps {
  merchant: CachedMerchant;
  sampleProducts: Array<{ name: string; category?: string; price?: number }>;
  initialFAQs: FAQItem[];
}

const FAQ_CATEGORIES = [
  'Shipping',
  'Payment',
  'Returns',
  'Products',
  'Orders',
  'General',
] as const;

export function FAQSettingsClient({
  merchant,
  sampleProducts,
  initialFAQs,
}: FAQSettingsClientProps) {
  const { toast } = useToast();
  const [faqs, setFaqs] = useState<FAQItem[]>(initialFAQs);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [_editingId, setEditingId] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/ai/generate-faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: merchant.business_name,
          businessType: merchant.business_type,
          country: merchant.country,
          description: merchant.site_description,
          products: sampleProducts,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate FAQs');
      }

      const data = await response.json();
      setFaqs(data.faqs);
      toast({
        title: 'FAQs Generated',
        description: `Generated ${data.faqs.length} FAQs. Review and save when ready.`,
      });
    } catch (error) {
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('merchants')
        .update({ faq_items: faqs })
        .eq('id', merchant.id);

      if (error) throw error;

      toast({
        title: 'FAQs Saved',
        description:
          'Your FAQ content has been saved and will appear on your store.',
      });
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddFAQ = () => {
    const newFAQ: FAQItem = {
      id: `faq-${Date.now()}`,
      question: '',
      answer: '',
      category: 'General',
      order: faqs.length,
    };
    setFaqs([...faqs, newFAQ]);
    // biome-ignore lint/style/noNonNullAssertion: Created with ID locally
    setEditingId(newFAQ.id!);
  };

  const handleUpdateFAQ = (id: string, updates: Partial<FAQItem>) => {
    setFaqs(faqs.map((faq) => (faq.id === id ? { ...faq, ...updates } : faq)));
  };

  const handleDeleteFAQ = (id: string) => {
    setFaqs(faqs.filter((faq) => faq.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">FAQ Settings</h1>
          <p className="text-muted-foreground">
            Manage your store&apos;s FAQ content for better SEO and customer
            support.
          </p>
        </div>
        <div className="flex gap-2">
          <ThemedButton
            variant="outline"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Wand2 className="mr-2 size-4" />
            )}
            {faqs.length > 0 ? 'Regenerate' : 'Generate'} with AI
          </ThemedButton>
          <ThemedButton
            onClick={handleSave}
            disabled={isSaving || faqs.length === 0}
          >
            {isSaving ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            Save FAQs
          </ThemedButton>
        </div>
      </div>

      {faqs.length === 0 ? (
        <ThemedCard className="p-8 text-center">
          <RefreshCw className="mx-auto size-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No FAQs yet</h3>
          <p className="mt-2 text-muted-foreground">
            Generate FAQs with AI or add them manually to improve your
            store&apos;s SEO.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <ThemedButton variant="outline" onClick={handleAddFAQ}>
              <Plus className="mr-2 size-4" />
              Add Manually
            </ThemedButton>
            <ThemedButton onClick={handleGenerate} disabled={isGenerating}>
              <Wand2 className="mr-2 size-4" />
              Generate with AI
            </ThemedButton>
          </div>
        </ThemedCard>
      ) : (
        <div className="space-y-4">
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={faq.id}
                // biome-ignore lint/style/noNonNullAssertion: Guaranteed by DB
                value={faq.id!}
                className="rounded-lg border bg-card px-4"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex flex-1 items-center gap-3 text-left">
                    <span className="text-muted-foreground">{index + 1}.</span>
                    <span className="flex-1 truncate">
                      {faq.question || 'New question...'}
                    </span>
                    {faq.category && (
                      <Badge variant="secondary" className="shrink-0">
                        {faq.category}
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor={`q-${faq.id}`}>Question</Label>
                      <Input
                        id={`q-${faq.id}`}
                        value={faq.question}
                        onChange={(e) =>
                          // biome-ignore lint/style/noNonNullAssertion: ID guaranteed
                          handleUpdateFAQ(faq.id!, { question: e.target.value })
                        }
                        placeholder="Enter question..."
                      />
                    </div>
                    <div>
                      <Label htmlFor={`a-${faq.id}`}>Answer</Label>
                      <Textarea
                        id={`a-${faq.id}`}
                        value={faq.answer}
                        onChange={(e) =>
                          // biome-ignore lint/style/noNonNullAssertion: ID guaranteed
                          handleUpdateFAQ(faq.id!, { answer: e.target.value })
                        }
                        placeholder="Enter answer..."
                        rows={3}
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <Label htmlFor={`c-${faq.id}`}>Category</Label>
                        <Select
                          value={faq.category || 'General'}
                          onValueChange={(value) =>
                            // biome-ignore lint/style/noNonNullAssertion: ID guaranteed by context
                            handleUpdateFAQ(faq.id!, { category: value })
                          }
                        >
                          <SelectTrigger id={`c-${faq.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FAQ_CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <ThemedButton
                        variant="ghost"
                        size="sm"
                        className="mt-6 text-destructive hover:text-destructive"
                        // biome-ignore lint/style/noNonNullAssertion: ID guaranteed by context
                        onClick={() => handleDeleteFAQ(faq.id!)}
                      >
                        <Trash2 className="size-4" />
                      </ThemedButton>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <ThemedButton
            variant="outline"
            onClick={handleAddFAQ}
            className="w-full"
          >
            <Plus className="mr-2 size-4" />
            Add FAQ
          </ThemedButton>
        </div>
      )}

      {faqs.length > 0 && (
        <ThemedCard className="bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">
            <strong>SEO Tip:</strong> Your FAQs will be displayed on your
            store&apos;s /faq page with JSON-LD schema markup, making them
            eligible for Google&apos;s rich search results.
          </p>
        </ThemedCard>
      )}
    </div>
  );
}
