# API Route Patterns

## Standard Pattern

Every protected API route follows this structure:

```typescript
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  // 1. Auth check FIRST
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Validate input with Zod
  const body = await request.json();
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: 'Invalid input', details: result.error.flatten() }, { status: 400 });
  }

  // 3. Process request with scoped query
  const { data, error } = await supabase
    .from('table')
    .select('id, name')
    .eq('merchant_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

## Anti-Pattern

```typescript
// BAD: No auth check, no validation, unscoped query
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.from('orders').select('*');
  return NextResponse.json(data);
}
```

## Requirements

- Auth check as first operation in all protected routes.
- Zod validation on all request bodies.
- CSRF token validation on POST/PUT/DELETE/PATCH.
- Consistent error shape: `{ error: string, code?: string }`.
- Response data scoped to authenticated user.
