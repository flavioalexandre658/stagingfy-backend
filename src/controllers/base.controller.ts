import { Request, Response } from 'express';
import { logger } from '@/lib/logger';

export abstract class BaseController {
  /**
   * Handle success response
   */
  protected success(res: Response, data: any, message?: string, statusCode = 200): void {
    res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  /**
   * Handle error response
   */
  protected error(res: Response, message: string, statusCode = 500, error?: any): void {
    if (error) {
      logger.error(message, error);
    } else {
      logger.error(message);
    }

    res.status(statusCode).json({
      success: false,
      message,
      error: process.env.NODE_ENV === 'development' ? error : undefined,
    });
  }

  /**
   * Handle validation error response
   */
  protected validationError(res: Response, errors: any): void {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  /**
   * Handle not found response
   */
  protected notFound(res: Response, resource = 'Resource'): void {
    res.status(404).json({
      success: false,
      message: `${resource} not found`,
    });
  }

  /**
   * Handle unauthorized response
   */
  protected unauthorized(res: Response, message = 'Unauthorized'): void {
    res.status(401).json({
      success: false,
      message,
    });
  }

  /**
   * Handle forbidden response
   */
  protected forbidden(res: Response, message = 'Forbidden'): void {
    res.status(403).json({
      success: false,
      message,
    });
  }

  /**
   * Extract pagination parameters from request
   */
  protected getPagination(req: Request): { page: number; limit: number; offset: number } {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
    const offset = (page - 1) * limit;

    return { page, limit, offset };
  }

  /**
   * Extract sorting parameters from request
   */
  protected getSorting(req: Request, allowedFields: string[] = []): { sortBy?: string; sortOrder: 'asc' | 'desc' } {
    const sortBy = req.query.sortBy as string;
    const sortOrder = (req.query.sortOrder as string)?.toLowerCase() === 'desc' ? 'desc' : 'asc';

    // Validate sortBy field
    if (sortBy && allowedFields.length > 0 && !allowedFields.includes(sortBy)) {
      return { sortOrder };
    }

    return { sortBy, sortOrder };
  }

  /**
   * Extract filters from request query
   */
  protected getFilters(req: Request, allowedFilters: string[] = []): Record<string, any> {
    const filters: Record<string, any> = {};

    for (const key of allowedFilters) {
      if (req.query[key] !== undefined) {
        filters[key] = req.query[key];
      }
    }

    return filters;
  }
}