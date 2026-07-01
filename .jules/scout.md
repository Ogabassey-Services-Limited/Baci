2024-07-01 — Notification API Route Mocking
Learning: Testing Next.js API routes with Supabase auth requires mocking the `hasPermission` utility function when it uses access objects derived from `getMerchantForApiRequest`. Chaining Supabase query filters like `.is()` requires setting up mocks that return appropriately nested structures `mockIs1.mockReturnValue({ is: mockIs2 })`.
Action: When testing routes that query Supabase using `.is().is()`, setup the mock chain explicitly rather than just `mockReturnThis()` to prevent TypeError "is not a function".
Source: Supabase js client docs v2 / vitest v4
