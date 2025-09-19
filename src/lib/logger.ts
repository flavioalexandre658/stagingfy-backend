import { Logtail } from '@logtail/node';

// Initialize Logtail if token is provided
const logtail = process.env.LOGTAIL_TOKEN ? new Logtail(process.env.LOGTAIL_TOKEN) : null;

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, meta || '');
    if (logtail) {
      logtail.info(message, meta);
    }
  },
  
  error: (message: string, error?: Error | Record<string, unknown>) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error || '');
    if (logtail) {
      logtail.error(message, error);
    }
  },
  
  warn: (message: string, meta?: Record<string, unknown>) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, meta || '');
    if (logtail) {
      logtail.warn(message, meta);
    }
  },
  
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, meta || '');
    }
    if (logtail) {
      logtail.debug(message, meta);
    }
  },
};