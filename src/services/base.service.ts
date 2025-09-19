import { logger } from '@/lib/logger';

/**
 * Base service class that provides common functionality for all services
 */
export abstract class BaseService {
  protected logger = logger;

  /**
   * Handle service errors with consistent logging and error formatting
   */
  protected handleError(error: unknown, context: string): never {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    this.logger.error(`${context}: ${errorMessage}`, {
      error: errorMessage,
      stack: errorStack,
      context,
    });

    throw new Error(`${context}: ${errorMessage}`);
  }

  /**
   * Log service operations for debugging and monitoring
   */
  protected logOperation(operation: string, data?: Record<string, any>): void {
    this.logger.info(`Service operation: ${operation}`, {
      operation,
      ...data,
    });
  }

  /**
   * Validate required parameters
   */
  protected validateRequired(params: Record<string, any>, requiredFields: string[]): void {
    const missingFields = requiredFields.filter(field => 
      params[field] === undefined || params[field] === null || params[field] === ''
    );

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
  }

  /**
   * Sanitize input data by removing undefined/null values
   */
  protected sanitizeInput<T extends Record<string, any>>(input: T): Partial<T> {
    const sanitized: Partial<T> = {};
    
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined && value !== null) {
        sanitized[key as keyof T] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * Create a standardized service response
   */
  protected createResponse<T>(data: T, message?: string): ServiceResponse<T> {
    const response: ServiceResponse<T> = {
      success: true,
      data,
    };
    
    if (message !== undefined) {
      response.message = message;
    }
    
    return response;
  }

  /**
   * Create a standardized error response
   */
  protected createErrorResponse(error: string, code?: string): ServiceErrorResponse {
    const response: ServiceErrorResponse = {
      success: false,
      error,
    };
    
    if (code !== undefined) {
      response.code = code;
    }
    
    return response;
  }
}

/**
 * Standard service response interface
 */
export interface ServiceResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

/**
 * Standard service error response interface
 */
export interface ServiceErrorResponse {
  success: false;
  error: string;
  code?: string;
}

/**
 * Pagination parameters interface
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

/**
 * Paginated response interface
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Service configuration interface
 */
export interface ServiceConfig {
  retryAttempts?: number;
  timeout?: number;
  enableLogging?: boolean;
}