
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useMerchant } from '@/hooks/use-merchant';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const pagesSchema = z.object({
  about: z.string().optional(),
  contact: z.string().optional(),
  privacy: z.string().optional(),
  terms: z.string().optional(),
  faq: z.string().optional(),
  legal: z.string().optional(),
});

type PagesFormValues = z.infer<typeof pagesSchema>;

const pageFields: { name: keyof PagesFormValues, label: string, description: string }[] = [
    { name: 'about', label: 'About Us', description: 'Tell your customers your story. What makes your brand special?' },
    { name: 'contact', label: 'Contact Information', description: 'How can customers get in touch? Provide an email, phone number, or address.' },
    { name: 'privacy', label: 'Privacy Policy', description: 'Explain how you collect, use, and protect customer data.' },
    { name: 'terms', label: 'Terms and Conditions', description: 'Set the rules for using your store and making purchases.' },
    { name: 'faq', label: 'Frequently Asked Questions', description: 'Answer common questions your customers might have.' },
    { name: 'legal', label: 'Legal and Dispute', description: 'Provide information on legal policies and how disputes are handled.' },
];

export default function PagesSettingsPage() {
  const { toast } = useToast();
  const { merchant, loading, updateMerchant } = useMerchant();
  const [isSaving, setIsSaving] = useState(false);

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

  useEffect(() => {
    if (merchant?.pages) {
      form.reset(merchant.pages);
    }
  }, [merchant, form]);

  async function onSubmit(data: PagesFormValues) {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
    updateMerchant({ pages: data });
    setIsSaving(false);
    toast({
      title: 'Pages Saved!',
      description: 'Your informational pages have been updated.',
    });
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 motion-safe:animate-spin" /></div>
  }

  return (
    <div className="grid gap-6">
      <Card className="glass">
        <CardHeader>
          <CardTitle>Store Pages</CardTitle>
          <CardDescription>
            Manage the content for your store's informational pages like "About Us" and "Privacy Policy". Links will appear in your footer if content is provided.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
               <Accordion type="single" collapsible className="w-full">
                {pageFields.map((page) => (
                   <AccordionItem value={page.name} key={page.name}>
                    <AccordionTrigger>{page.label}</AccordionTrigger>
                    <AccordionContent>
                       <FormField
                        control={form.control}
                        name={page.name}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="sr-only">{page.label}</FormLabel>
                            <FormControl>
                              <Textarea placeholder={`Content for your ${page.label} page...`} {...field} className="min-h-[200px]"/>
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
                {isSaving && <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />}
                Save Page Content
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
