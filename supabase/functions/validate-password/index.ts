import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const HIBP_API_URL = 'https://api.pwnedpasswords.com/range/';

interface HookPayload {
  user_id?: string;
  claims?: {
    email?: string;
  };
  password?: string;
}

/**
 * SHA-1 hash function using Web Crypto API
 */
async function sha1(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hashHex.toUpperCase();
}

/**
 * Check if password has been pwned using k-anonymity model
 * Only sends first 5 characters of hash to HIBP
 */
async function isPasswordPwned(password: string): Promise<boolean> {
  try {
    // Hash the password
    const hash = await sha1(password);

    // k-anonymity: only send first 5 chars
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);

    // Query HIBP API
    const response = await fetch(`${HIBP_API_URL}${prefix}`, {
      headers: {
        'Add-Padding': 'true', // Extra security
        'User-Agent': 'Baci-PasswordValidator',
      },
    });

    if (!response.ok) {
      console.error('HIBP API error:', response.status);
      // Fail open: if HIBP is down, allow password
      return false;
    }

    const responseText = await response.text();
    const hashes = responseText.split('\n');

    // Check if our suffix exists in the response
    for (const line of hashes) {
      const [hashSuffix] = line.split(':');
      if (hashSuffix === suffix) {
        return true; // Password is pwned
      }
    }

    return false; // Password is clean
  } catch (error) {
    console.error('Error checking password:', error);
    // Fail open: if check fails, allow password
    return false;
  }
}

serve(async (req) => {
  try {
    const payload: HookPayload = await req.json();
    const password = payload.password;

    if (!password) {
      return new Response(
        JSON.stringify({
          error: {
            http_code: 400,
            message: 'Password is required',
          },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if password has been breached
    const isPwned = await isPasswordPwned(password);

    if (isPwned) {
      return new Response(
        JSON.stringify({
          error: {
            http_code: 422,
            message:
              'This password has been compromised in a data breach. Please choose a different password.',
          },
        }),
        {
          status: 200, // Return 200 with error payload for auth hooks
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Password is clean
    return new Response(
      JSON.stringify({
        decision: 'continue',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Validation error:', error);
    // Fail open: allow signup to continue if validation fails
    return new Response(
      JSON.stringify({
        decision: 'continue',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
