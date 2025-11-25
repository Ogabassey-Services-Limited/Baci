import { SupabaseClient } from '@supabase/supabase-js';

export interface AuditLogEntry {
    user_id: string;
    merchant_id?: string;
    action: string;
    resource_type: 'domain' | 'dns' | 'email_forwarding' | 'id_protection';
    resource_id: string;
    changes?: {
        before?: Record<string, unknown>;
        after?: Record<string, unknown>;
    };
    ip_address?: string;
    user_agent?: string;
    status: 'success' | 'failure';
    error_message?: string;
}

/**
 * Log an audit entry
 */
export async function logAudit(
    supabase: SupabaseClient,
    entry: AuditLogEntry
): Promise<void> {
    try {
        // Fire and forget - don't await unless critical
        const { error } = await supabase.from('audit_logs').insert({
            ...entry,
            timestamp: new Date().toISOString(),
        });

        if (error) {
            console.error('Failed to write audit log:', error);
        }
    } catch (err) {
        console.error('Exception writing audit log:', err);
    }
}
