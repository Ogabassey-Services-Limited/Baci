'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import z from 'zod';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { BagLoader } from '@/components/ui/bag-loader';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useMerchant } from '@/hooks/use-merchant-client';
import { useToast } from '@/hooks/use-toast';

const pagesSchema = z.object({
  about: z.string().optional(),
  contact: z.string().optional(),
  privacy: z.string().optional(),
  terms: z.string().optional(),
  faq: z.string().optional(),
  legal: z.string().optional(),
});

type PagesFormValues = z.infer<typeof pagesSchema>;

const pageFields: {
  name: keyof PagesFormValues;
  label: string;
  description: string;
}[] = [
  {
    name: 'about',
    label: 'About Us',
    description:
      'Tell your customers your story. What makes your brand special?',
  },
  {
    name: 'contact',
    label: 'Contact Information',
    description:
      'How can customers get in touch? Provide an email, phone number, or address.',
  },
  {
    name: 'privacy',
    label: 'Privacy Policy',
    description: 'Explain how you collect, use, and protect customer data.',
  },
  {
    name: 'terms',
    label: 'Terms and Conditions',
    description: 'Set the rules for using your store and making purchases.',
  },
  {
    name: 'faq',
    label: 'Frequently Asked Questions',
    description: 'Answer common questions your customers might have.',
  },
  {
    name: 'legal',
    label: 'Legal and Dispute',
    description:
      'Provide information on legal policies and how disputes are handled.',
  },
];

export default function PagesClient() {
  const { toast } = useToast();
  const { merchant, loading, updateMerchant } = useMerchant();
  const [isSaving, setIsSaving] = useState(false);
  const [completedPages, setCompletedPages] = useState<Record<string, boolean>>(
    {}
  );
  // Track specific page being toggled to prevent race conditions
  const [togglingPage, setTogglingPage] = useState<string | null>(null);

  const form = useForm<PagesFormValues>({
    resolver: zodResolver(pagesSchema),
    defaultValues: {
      about: '',
      contact: '',
      privacy: '',
      terms: '',
      faq: '',
      legal: '',
    },
  });

  // Track initialization to prevent overwriting user input
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && merchant?.pages) {
      form.reset(merchant.pages);
      setInitialized(true);
    }
    if (merchant?.feature_settings?.pages_completed) {
      const pagesCompleted = merchant.feature_settings.pages_completed;
      if (pagesCompleted && typeof pagesCompleted === 'object') {
        setCompletedPages(pagesCompleted as Record<string, boolean>);
      }
    }
  }, [merchant, form, initialized]);

  const handleStatusChange = async (pageName: string, checked: boolean) => {
    if (togglingPage) return; // Prevent concurrent updates

    setTogglingPage(pageName);
    const previousStatus = !!completedPages[pageName]; // Ensure boolean
    // Optimistic update
    const newStatus = { ...completedPages, [pageName]: checked };
    setCompletedPages(newStatus);

    const newFeatureSettings = {
      ...(merchant?.feature_settings || {}),
      pages_completed: newStatus,
    };

    try {
      await updateMerchant(
        { feature_settings: newFeatureSettings },
        { skipReload: true }
      );
    } catch (_error) {
      // Revert on error using functional update to avoid stale closure
      setCompletedPages((prev) => ({ ...prev, [pageName]: previousStatus }));
      toast({
        title: 'Error',
        description: 'Failed to update page status.',
        variant: 'destructive',
      });
    } finally {
      setTogglingPage(null);
    }
  };

  async function onSubmit(data: PagesFormValues) {
    setIsSaving(true);
    try {
      await updateMerchant({ pages: data });
      toast({
        title: 'Pages Saved!',
        description: 'Your informational pages have been updated.',
      });
    } catch (error) {
      console.error('Failed to save pages:', error);
      toast({
        title: 'Error',
        description: 'Failed to save page content.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <BagLoader size={32} />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <Card className="glass">
        <CardHeader>
          <CardTitle>Store Pages</CardTitle>
          <CardDescription>
            Manage the content for your store's informational pages like "About
            Us" and "Privacy Policy". Links will appear in your footer if
            content is provided.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <Accordion type="single" collapsible className="w-full">
                {pageFields.map((page) => (
                  <AccordionItem value={page.name} key={page.name}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3">
                        <span>{page.label}</span>
                        {completedPages[page.name] && (
                          <Badge
                            variant="secondary"
                            className="bg-green-100 text-green-700 hover:bg-green-100/80 gap-1"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Completed
                          </Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex items-center space-x-2 mb-6 pb-4 border-b">
                        <Switch
                          id={`status-${page.name}`}
                          checked={!!completedPages[page.name]}
                          onCheckedChange={(checked) =>
                            handleStatusChange(page.name, checked)
                          }
                          disabled={togglingPage === page.name}
                          aria-label={`Mark ${page.label} as completed`}
                        />
                        <Label
                          htmlFor={`status-${page.name}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Mark as Completed
                        </Label>
                      </div>
                      <FormField
                        control={form.control}
                        name={page.name}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="sr-only">
                              {page.label}
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder={`Content for your ${page.label} page...`}
                                {...field}
                                className="min-h-[200px]"
                              />
                            </FormControl>
                            <FormDescription>
                              {page.description}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>

              <Button type="submit" disabled={isSaving}>
                {isSaving && <BagLoader size={16} />}
                Save Page Content
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
