/**
 * Checks whether a plaintext password appears in known breaches using the HaveIBeenPwned k-Anonymity range API.
 *
 * Uses the k-Anonymity approach to avoid sending the full password hash to the service and verifies any matches locally.
 *
 * @param password - The plaintext password to check
 * @returns An object where `isBreached` is `true` if the password was found in breach data (includes `count` with occurrences), `false` otherwise. On failure to perform the check, returns `isBreached: false` and an `error` string describing the failure.
 */
export async function checkPasswordBreach(password: string): Promise<{
    isBreached: boolean;
    count?: number;
    error?: string;
}> {
    try {
        // Hash the password using SHA-1
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-1', data);

        // Convert to hex string
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

        // Split into prefix (first 5 chars) and suffix (rest)
        const prefix = hashHex.slice(0, 5);
        const suffix = hashHex.slice(5);

        // Query the HIBP API with just the prefix
        const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
            headers: {
                'Add-Padding': 'true', // Adds padding to prevent response length attacks
            },
        });

        if (!response.ok) {
            throw new Error(`HIBP API returned ${response.status}`);
        }

        const text = await response.text();

        // Parse response - format is "SUFFIX:COUNT" per line
        const lines = text.split('\n');
        for (const line of lines) {
            const [hashSuffix, countStr] = line.split(':');
            if (hashSuffix.trim() === suffix) {
                const count = parseInt(countStr.trim(), 10);
                return { isBreached: true, count };
            }
        }

        return { isBreached: false };
    } catch (error) {
        console.error('Password breach check failed:', error);
        // Fail open - if the check fails, allow the password
        // This prevents blocking users if HIBP is down
        return { isBreached: false, error: 'Unable to verify password security' };
    }
}