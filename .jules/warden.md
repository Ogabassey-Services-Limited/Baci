YYYY-MM-DD — [Validation of API Route Bodies]
Learning: Blindly type-casting the request body in an API route bypasses runtime safety and creates a data-integrity risk.
Action: Always use Zod `safeParse` to validate the incoming API payload against a defined schema and return a 400 error if it fails, instead of type casting.
Source: Zod 4 documentation, Warden persona rules
