'use client';

import { Sparkles } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
  {
    question: 'What is Baci?',
    answer:
      'Baci is an AI-powered e-commerce website builder. It allows you to create a professional, fully functional online store in minutes without writing any code. Our AI handles design, product descriptions, and initial setup for you.',
  },
  {
    question: 'Do I need coding skills to use Baci?',
    answer:
      "No, Baci is a 100% no-code platform. You can build, customize, and manage your entire store using our visual editor and AI tools. It's designed for business owners, not developers.",
  },
  {
    question: 'Is Baci good for SEO?',
    answer:
      'Yes, Baci stores are built with SEO best practices automatically. We include server-side rendering, automatic sitemaps, semantic HTML, and optimized metadata to help your store rank on Google.',
  },
  {
    question: 'Can I use my own domain name?',
    answer:
      'Yes, you can connect your own custom domain (e.g., yourstore.com) to your Baci store. We also provide a free .baci.store subdomain to get you started immediately.',
  },
  {
    question: 'How much does Baci cost?',
    answer:
      'Baci offers a free plan to get started. Premium features like custom domains and advanced analytics are available on our paid plans. Check our pricing page for the latest details.',
  },
];

export function FAQ() {
  return (
    <section
      className="w-full py-24 md:py-32 bg-slate-50 dark:bg-slate-900/50"
      id="faq"
    >
      <div className="container px-4 md:px-6 max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/50 dark:bg-white/5 border border-accent/20 rounded-full text-accent text-sm font-medium backdrop-blur-sm mb-6">
            <Sparkles className="w-4 h-4" />
            <span>Common Questions</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl mb-4 text-primary dark:text-white">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-muted-foreground">
            Everything you need to know about building your store with Baci.
          </p>
        </div>

        <div className="glass rounded-3xl p-8 md:p-12">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq) => (
              <AccordionItem
                key={faq.question}
                value={faq.question}
                className="border-b-border/50 last:border-0"
              >
                <AccordionTrigger className="text-lg font-semibold text-left hover:text-accent transition-colors">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* JSON-LD Schema for SGE Optimization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: faqs.map((faq) => ({
                '@type': 'Question',
                name: faq.question,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: faq.answer,
                },
              })),
            }),
          }}
        />
      </div>
    </section>
  );
}
