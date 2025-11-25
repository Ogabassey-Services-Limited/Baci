/**
 * Check if a password has been compromised in a data breach
 * Uses HaveIBeenPwned API via Supabase Edge Function
 */
export async function checkPasswordBreach(password: string): Promise<{
    isBreached: boolean;
    error?: string
}> {
    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/validate-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ password })
        });

        const data = await response.json();

        if (data.error) {
            return { isBreached: true };
        }

        return { isBreached: false };
    } catch (error) {
        console.error('Password breach check failed:', error);
        // Fail open - if the check fails, allow the password
        return { isBreached: false, error: 'Unable to verify password security' };
    }
}
