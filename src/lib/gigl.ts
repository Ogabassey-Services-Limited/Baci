
// src/lib/gigl.ts

import { logger } from './logger';

const GIGL_BASE_URL = process.env.GIGL_BASE_URL || 'https://dev-thirdpartynode.theagilitysystems.com';
const GIGL_EMAIL = process.env.GIGL_EMAIL;
const GIGL_PASSWORD = process.env.GIGL_PASSWORD;
const GIGL_TOKEN_EXPIRY_MS = 20 * 24 * 60 * 60 * 1000; // 20 days


interface GiglToken {
    token: string;
    userChannelCode: string;
    userChannelType: number;
    expiresAt: number;
}

// In-memory cache for the token
let apiToken: GiglToken | null = null;

async function getApiToken(): Promise<GiglToken> {
    if (apiToken && Date.now() < apiToken.expiresAt) {
        return apiToken;
    }

    logger.info({ message: 'GIGL token expired or not present, fetching new token.' });

    if (!GIGL_EMAIL || !GIGL_PASSWORD) {
        throw new Error('GIGL email or password not configured in environment variables.');
    }

    const response = await fetch(`${GIGL_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: GIGL_EMAIL, password: GIGL_PASSWORD }),
    });

    if (!response.ok) {
        logger.error({ message: 'GIGL login failed', status: response.status, response: await response.text() });
        throw new Error('GIGL API authentication failed.');
    }

    const result = await response.json();
    const token = result.data['access-token'];
    const userChannelCode = result.data.UserChannelCode;
    const userChannelType = result.data.UserChannelType;

    if (!token || !userChannelCode || userChannelType === undefined) {
        throw new Error('Failed to retrieve all required fields from GIGL login response.');
    }
    
    // Set expiry to 20 days (token seems to be valid for 20 days based on iat/exp)
    const expiresAt = Date.now() + GIGL_TOKEN_EXPIRY_MS;

    apiToken = { token, userChannelCode, userChannelType, expiresAt };
    return apiToken;
}

export async function getGiglPrice(payload: unknown) {
    const tokenData = await getApiToken();

    const response = await fetch(`${GIGL_BASE_URL}/shipments/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'access-token': tokenData.token,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        logger.error({ message: 'GIGL getPrice failed', status: response.status, errorBody });
        throw new Error('Failed to get GIGL shipping price.');
    }

    return response.json();
}

export async function createGiglShipment(payload: unknown) {
    const tokenData = await getApiToken();

    const response = await fetch(`${GIGL_BASE_URL}/capture/preshipment`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'access-token': tokenData.token,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        logger.error({ message: 'GIGL createShipment failed', status: response.status, errorBody });
        throw new Error('Failed to create GIGL shipment.');
    }

    return response.json();
}

export async function trackGiglShipment(waybill: string) {
    const tokenData = await getApiToken();

    const response = await fetch(`${GIGL_BASE_URL}/track/mobileShipment?Waybill=${waybill}`, {
        method: 'GET',
        headers: {
            'access-token': tokenData.token,
        },
    });

    if (!response.ok) {
        const errorBody = await response.text();
        logger.error({ message: 'GIGL trackShipment failed', status: response.status, errorBody });
        throw new Error('Failed to track GIGL shipment.');
    }

    return response.json();
}
