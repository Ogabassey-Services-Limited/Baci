const VERCEL_API_URL = 'https://api.vercel.com';

type VercelConfig = {
    token: string;
    projectId: string;
    teamId?: string;
};

function getConfig(): VercelConfig {
    const token = process.env.VERCEL_API_TOKEN;
    const projectId = process.env.VERCEL_PROJECT_ID;
    const teamId = process.env.VERCEL_TEAM_ID;

    if (!token || !projectId) {
        throw new Error('Missing Vercel configuration (VERCEL_API_TOKEN or VERCEL_PROJECT_ID)');
    }

    return { token, projectId, teamId };
}

async function fetchVercel(path: string, options: RequestInit = {}) {
    const config = getConfig();
    const url = new URL(`${VERCEL_API_URL}${path}`);

    if (config.teamId) {
        url.searchParams.append('teamId', config.teamId);
    }

    const headers = {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
    };

    const response = await fetch(url.toString(), {
        ...options,
        headers,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || 'Vercel API request failed');
    }

    return data;
}

export type VercelDomainResponse = {
    name: string;
    apexName: string;
    projectId: string;
    redirect?: string | null;
    redirectStatusCode?: number | null;
    gitBranch?: string | null;
    updatedAt: number;
    createdAt: number;
    verified: boolean;
    verification?: {
        type: string;
        domain: string;
        value: string;
        reason: string;
    }[];
};

export type VercelVerifyResponse = {
    name: string;
    apexName: string;
    projectId: string;
    verified: boolean;
    verification?: {
        type: string;
        domain: string;
        value: string;
        reason: string;
    }[];
};

export const vercel = {
    /**
     * Add a domain to the Vercel project
     */
    addDomain: async (domain: string): Promise<VercelDomainResponse> => {
        const config = getConfig();
        return fetchVercel(`/v10/projects/${config.projectId}/domains`, {
            method: 'POST',
            body: JSON.stringify({ name: domain }),
        });
    },

    /**
     * Verify a domain
     */
    verifyDomain: async (domain: string): Promise<VercelVerifyResponse> => {
        const config = getConfig();
        return fetchVercel(`/v9/projects/${config.projectId}/domains/${domain}/verify`, {
            method: 'POST',
        });
    },

    /**
     * Remove a domain from the Vercel project
     */
    removeDomain: async (domain: string) => {
        const config = getConfig();
        return fetchVercel(`/v9/projects/${config.projectId}/domains/${domain}`, {
            method: 'DELETE',
        });
    },

    /**
     * Get domain configuration (checks for misconfiguration)
     */
    getDomainConfig: async (domain: string) => {
        return fetchVercel(`/v6/domains/${domain}/config`);
    },
};
