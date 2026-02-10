/**
 * Juicyway API Client — low-level HTTP wrapper
 */

import { logger } from '../logger';
import type { JuicywayApiResponse, JuicywayResult } from './types';

// =============================================================================
// Configuration
// =============================================================================

export const JUICYWAY_BASE_URL =
  process.env.JUICYWAY_BASE_URL || 'https://api.spendjuice.com';
export const JUICYWAY_SECRET_KEY = process.env.JUICYWAY_SECRET_KEY || '';

// =============================================================================
// API Client
// =============================================================================

export async function juicywayRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<JuicywayResult<JuicywayApiResponse<T>>> {
  const url = `${JUICYWAY_BASE_URL}${endpoint}`;

  if (!JUICYWAY_SECRET_KEY) {
    return {
      success: false,
      error: 'JUICYWAY_SECRET_KEY is not configured',
      code: 'CONFIG_ERROR',
    };
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: JUICYWAY_SECRET_KEY,
        ...options.headers,
      },
    });

    const data = await response.json();

    logger.info({
      message: 'Juicyway API Response',
      endpoint,
      status: response.status,
      responseKeys: Object.keys(data),
    });

    if (!response.ok) {
      logger.error({
        message: 'Juicyway API Error',
        status: response.status,
        error: data.message || 'Unknown error',
        errors: data.errors || data,
      });
      return {
        success: false,
        error: data.message || `API request failed: ${response.status}`,
        code: `HTTP_${response.status}`,
      };
    }

    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error';
    logger.error({ message: 'Juicyway request failed', error: message });
    return { success: false, error: message, code: 'NETWORK_ERROR' };
  }
}
