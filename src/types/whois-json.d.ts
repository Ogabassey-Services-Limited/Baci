declare module 'whois-json' {
    export default function whois(domain: string, options?: Record<string, unknown>): Promise<Record<string, unknown>>;
}
