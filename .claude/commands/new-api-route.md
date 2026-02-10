Create a new API route at the specified path following Baci conventions.

Requirements:
1. Use the standard API route pattern:
   - Import NextRequest, NextResponse from 'next/server'
   - Import createClient from '@/lib/supabase/server'
   - Auth check as first operation
   - Zod schema validation for request body
   - Proper error handling with typed responses
   - Consistent error shape: { error: string, code?: string }
2. Include CSRF token validation for non-GET methods
3. Add TypeScript types for request/response
4. Follow existing naming conventions in src/app/api/
5. Check if rate limiting is needed (mention in comments)

The route path is: $ARGUMENTS
