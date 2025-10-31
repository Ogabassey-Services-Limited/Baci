// A simple logger to help with debugging.
// In a real production app, you would use a more robust logging service.

type LogLevel = 'info' | 'warn' | 'error';

interface LogPayload {
  message: string;
  [key: string]: any;
}

const log = (level: LogLevel, payload: LogPayload | Error) => {
  const timestamp = new Date().toISOString();
  if (payload instanceof Error) {
    console[level](`[${timestamp}] [${level.toUpperCase()}] ${payload.message}`, payload);
  } else {
    console[level](`[${timestamp}] [${level.toUpperCase()}] ${payload.message}`, {
      ...payload,
    });
  }
};

export const logger = {
  info: (payload: LogPayload) => log('info', payload),
  warn: (payload: LogPayload) => log('warn', payload),
  error: (payload: LogPayload | Error) => log('error', payload),
};
