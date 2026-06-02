# Frontend Integration Guide for Baci Platform

## Overview

This document provides all the technical requirements for preparing a frontend application to integrate with the Baci e-commerce backend. Follow these specifications exactly to ensure compatibility.

---

## 1. Required Tech Stack

Your frontend MUST use these specific technologies:

| Technology | Version | Required | Notes |
|------------|---------|----------|-------|
| **Next.js** | 14+ | YES | Must use App Router (NOT Pages Router) |
| **React** | 18+ | YES | |
| **TypeScript** | 5+ | YES | NO plain JavaScript files |
| **Tailwind CSS** | 3.4+ | YES | NO CSS modules, NO styled-components, NO Sass |
| **Shadcn/UI** | Latest | YES | Built on Radix UI primitives |
| **Radix UI** | Latest | YES | Headless component library |
| **React Hook Form** | 7+ | YES | For all form handling |
| **Zod** | 4+ | YES | For form validation schemas |
| **Lucide React** | Latest | YES | NO other icon libraries (no FontAwesome, no Heroicons) |

### Why These Specific Libraries?

The Baci platform already uses these libraries. Using different ones will cause:
- Style conflicts
- Bundle size bloat
- Inconsistent UI/UX
- Integration delays

---

## 2. Project Structure

Organize your files exactly like this:

```
src/
├── app/
│   └── dashboard/
│       └── [feature-name]/
│           ├── page.tsx           # Main page component
│           ├── loading.tsx        # Loading state (optional)
│           └── error.tsx          # Error boundary (optional)
│
├── components/
│   ├── ui/                        # Shadcn base components (DO NOT MODIFY)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── dialog.tsx
│   │   ├── table.tsx
│   │   └── ... (other Shadcn components)
│   │
│   └── [feature-name]/            # Your feature-specific components
│       ├── feature-list.tsx
│       ├── feature-form.tsx
│       ├── feature-card.tsx
│       └── ...
│
├── hooks/                         # Custom React hooks (if needed)
│   └── use-[feature].ts
│
├── types/                         # TypeScript type definitions
│   └── [feature].ts
│
└── lib/
    └── utils.ts                   # Must include cn() utility
```

---

## 3. Code Patterns (MUST FOLLOW)

### 3.1 Component File Structure

Every interactive component must follow this pattern:

```typescript
// src/components/[feature]/example-component.tsx

'use client';  // REQUIRED for any component with interactivity

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Shadcn UI imports
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

// Lucide icons ONLY
import { Plus, Edit, Trash, Loader2 } from 'lucide-react';

// Local imports
import { cn } from '@/lib/utils';

// Zod schema for form validation
const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.email({ error: 'Invalid email' }),
  amount: z.coerce.number().min(0, 'Must be positive'),
});

type FormValues = z.infer<typeof formSchema>;

interface ExampleComponentProps {
  initialData?: FormValues;
  onSubmit: (data: FormValues) => Promise<void>;
}

export function ExampleComponent({ initialData, onSubmit }: ExampleComponentProps) {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      name: '',
      email: '',
      amount: 0,
    },
  });

  const handleSubmit = async (data: FormValues) => {
    setIsLoading(true);
    try {
      await onSubmit(data);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Example Form</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
```

### 3.2 Page Component Structure

```typescript
// src/app/dashboard/[feature]/page.tsx

import { Metadata } from 'next';
import { FeatureList } from '@/components/[feature]/feature-list';

export const metadata: Metadata = {
  title: 'Feature Name | Dashboard',
  description: 'Description of this feature',
};

export default function FeaturePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Feature Name</h1>
      </div>

      <FeatureList />
    </div>
  );
}
```

### 3.3 The cn() Utility (REQUIRED)

You MUST have this utility function:

```typescript
// src/lib/utils.ts

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Install the dependencies:
```bash
npm install clsx tailwind-merge
```

### 3.4 Data Fetching Pattern

Use this pattern for API calls (we will wire these up to real endpoints):

```typescript
// In your component
const [data, setData] = useState<DataType[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/[endpoint]');
      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  fetchData();
}, []);
```

### 3.5 Toast Notifications

Use this pattern for user feedback:

```typescript
import { useToast } from '@/hooks/use-toast';

// In your component
const { toast } = useToast();

// Success
toast({
  title: 'Success',
  description: 'Item created successfully',
});

// Error
toast({
  title: 'Error',
  description: 'Something went wrong',
  variant: 'destructive',
});
```

---

## 4. Shadcn Components to Use

These are the available UI components. Use ONLY these:

### Layout & Container
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`
- `Separator`
- `ScrollArea`
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`

### Forms
- `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`
- `Input`
- `Textarea`
- `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`
- `Checkbox`
- `RadioGroup`, `RadioGroupItem`
- `Switch`
- `Slider`
- `Calendar`
- `DatePicker`

### Buttons & Actions
- `Button` (variants: default, destructive, outline, secondary, ghost, link)
- `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`
- `AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogAction`, `AlertDialogCancel`

### Data Display
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`
- `Badge`
- `Avatar`, `AvatarImage`, `AvatarFallback`
- `Progress`
- `Skeleton`

### Feedback
- `Alert`, `AlertTitle`, `AlertDescription`
- `Toast` (via useToast hook)
- `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`
- `Sheet`, `SheetTrigger`, `SheetContent`, `SheetHeader`, `SheetTitle`
- `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`
- `Popover`, `PopoverTrigger`, `PopoverContent`

### Navigation
- `NavigationMenu`
- `Breadcrumb`
- `Command` (command palette)

---

## 5. Tailwind CSS Guidelines

### Use These Patterns

```tsx
// Spacing
<div className="p-4 space-y-4">      {/* Padding and vertical spacing */}
<div className="px-6 py-4">          {/* Horizontal and vertical padding */}
<div className="mt-4 mb-2">          {/* Margins */}
<div className="gap-4">              {/* Grid/flex gap */}

// Flexbox
<div className="flex items-center justify-between">
<div className="flex flex-col gap-2">
<div className="flex-1">             {/* Flex grow */}

// Grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

// Typography
<h1 className="text-2xl font-bold tracking-tight">
<p className="text-sm text-muted-foreground">
<span className="font-medium">

// Colors (use semantic colors)
<div className="bg-background text-foreground">
<div className="bg-muted text-muted-foreground">
<div className="bg-primary text-primary-foreground">
<div className="bg-destructive text-destructive-foreground">
<div className="border border-border">

// Responsive
<div className="hidden md:block">    {/* Hide on mobile */}
<div className="md:hidden">          {/* Show only on mobile */}

// Conditional classes using cn()
<div className={cn(
  "base-classes",
  isActive && "active-classes",
  variant === "large" && "large-classes"
)}>
```

### DO NOT Use

```tsx
// NO inline styles
<div style={{ padding: '16px' }}>  // BAD

// NO CSS modules
import styles from './component.module.css'  // BAD

// NO arbitrary values when Tailwind has the class
<div className="p-[16px]">  // BAD - use p-4 instead

// NO custom colors - use semantic tokens
<div className="bg-[#1a1a1a]">  // BAD
<div className="text-[#666]">   // BAD
```

---

## 6. TypeScript Types

Define types for all data structures:

```typescript
// src/types/[feature].ts

export interface FeatureItem {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'inactive' | 'pending';
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface FeatureFormData {
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'pending';
  amount: number;
}

export interface FeatureListResponse {
  data: FeatureItem[];
  total: number;
  page: number;
  per_page: number;
}

export interface FeatureFilters {
  status?: string;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}
```

---

## 7. Feature Documentation Template

For EACH feature you build, create a markdown file with this information:

```markdown
# Feature: [Feature Name]

## Description
[2-3 sentences explaining what this feature does and why it's useful]

## Screenshots
[Include screenshots or links to Figma designs]

## Components Created
| Component | File Path | Purpose |
|-----------|-----------|---------|
| FeatureList | src/components/feature/feature-list.tsx | Displays list of items |
| FeatureForm | src/components/feature/feature-form.tsx | Create/edit form |
| FeatureCard | src/components/feature/feature-card.tsx | Individual item display |

## Pages Created
| Page | Route | Purpose |
|------|-------|---------|
| Feature List | /dashboard/feature | Main listing page |
| Feature Detail | /dashboard/feature/[id] | Individual item view |
| Create Feature | /dashboard/feature/new | Creation form |

## Data Structure
```typescript
interface Feature {
  id: string;
  // ... list all fields with types
}
```

## User Actions
1. **View List**: User sees all items with filtering/sorting
2. **Create Item**: User fills form, submits, item is created
3. **Edit Item**: User clicks edit, modifies form, saves changes
4. **Delete Item**: User clicks delete, confirms, item is removed

## API Endpoints Needed
| Method | Endpoint | Request Body | Response |
|--------|----------|--------------|----------|
| GET | /api/feature | - | `{ data: Feature[], total: number }` |
| GET | /api/feature/[id] | - | `{ data: Feature }` |
| POST | /api/feature | `{ name, description, ... }` | `{ data: Feature }` |
| PATCH | /api/feature/[id] | `{ name?, description?, ... }` | `{ data: Feature }` |
| DELETE | /api/feature/[id] | - | `{ success: true }` |

## Validation Rules
- name: Required, min 3 characters
- description: Optional, max 500 characters
- amount: Required, must be >= 0

## Third-Party APIs (if any)
- None
OR
- Service Name: [What it's used for]
- API Docs: [URL]
```

---

## 8. Delivery Checklist

Before sending the code, verify:

### Project Structure
- [ ] Using Next.js 14+ with App Router
- [ ] All files are TypeScript (.ts, .tsx)
- [ ] No JavaScript files (.js, .jsx)
- [ ] Tailwind CSS configured
- [ ] Shadcn/UI components in /components/ui/
- [ ] cn() utility in /lib/utils.ts

### Code Quality
- [ ] All interactive components have 'use client' directive
- [ ] All forms use React Hook Form + Zod
- [ ] All icons are from Lucide React
- [ ] No inline styles
- [ ] No CSS modules
- [ ] No external CSS libraries

### Documentation
- [ ] Feature documentation for each feature (using template above)
- [ ] TypeScript types defined for all data structures
- [ ] Screenshots or mockups included

### Testing
- [ ] Components render without errors
- [ ] Forms validate correctly
- [ ] Loading states work
- [ ] Error states work

---

## 9. How to Deliver

### Option A: GitHub Repository
1. Push code to GitHub
2. Make repository accessible (public or invite collaborator)
3. Send repository URL

### Option B: Zip File
1. Run `npm run build` to verify no build errors
2. Delete node_modules folder
3. Delete .next folder
4. Zip the project folder
5. Send zip file

---

## 10. Existing Baci Features (For Reference)

These features already exist in Baci. Your new features should complement these:

| Feature | Description |
|---------|-------------|
| Products | Product management with variants, images, inventory |
| Orders | Order management with shipping integration |
| Customers | Customer list with RFM segmentation |
| Blog | WYSIWYG editor with auto-SEO |
| Loyalty Program | Points, tiers, rewards system |
| Discount Codes | Percentage/fixed discounts with limits |
| Reviews | Product reviews with moderation |
| Wishlist | Customer wishlists |
| Team Management | Staff roles and permissions |
| Analytics | GA4, Facebook Pixel, TikTok integration |
| Payments | Paystack, Korapay, Pay-on-Delivery |
| Shipping | GIGL, TopShip integration |
| VTU | Airtime/data sales |
| Custom Domains | Domain management |

---

## 11. Questions?

If anything is unclear, ask before building. It's easier to clarify requirements than to refactor code later.

Key questions to consider:
1. Does this feature overlap with existing features?
2. What data does this feature need?
3. How should this integrate with existing features?
4. Are there any third-party services needed?

---

## Summary

**MUST USE:**
- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
- Shadcn/UI + Radix UI
- React Hook Form + Zod
- Lucide React icons

**MUST PROVIDE:**
- Source code (GitHub or zip)
- Feature documentation for each feature
- TypeScript type definitions
- Screenshots/mockups

**DO NOT USE:**
- Pages Router
- Plain JavaScript
- CSS modules / styled-components / Sass
- Other icon libraries
- Inline styles
