declare module 'whois-json' {
    export default function whois(domain: string, options?: any): Promise<any>;
}
