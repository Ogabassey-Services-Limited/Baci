import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Check rate limit for a specific action
 * @param supabase Supabase client
 * @param identifier User ID or IP address
 * @param endpoint Endpoint or action name (e.g. 'dns_update', 'domain_register')
 * @param maxRequests Maximum requests allowed in the window
 * @param windowMinutes Window size in minutes
 * @returns true if allowed, false if limit exceeded
 */
export async function checkRateLimit(
    supabase: SupabaseClient,
    identifier: string,
    endpoint: string,
    maxRequests: number = 100,
    windowMinutes: number = 1
): Promise<boolean> {
    try {
        const { data, error } = await supabase.rpc('check_rate_limit', {
            identifier_param: identifier,
            endpoint_param: endpoint,
            max_requests: maxRequests,
            window_minutes: windowMinutes,
        });

        if (error) {
            console.error('Rate limit check error:', error);
            // Fail open if rate limiting fails (to avoid blocking legitimate users on system error)
            // Or fail closed depending on security posture. Here we fail open but log error.
            return true;
        }

        return data as boolean;
    } catch (err) {
        console.error('Rate limit exception:', err);
        return true;
    }
}
