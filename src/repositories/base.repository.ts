import { logger } from '@/lib/logger';

export interface BaseEntity {
  id: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Base repository class with common utilities
 */
export abstract class BaseRepository<T extends BaseEntity> {
  protected abstract tableName: string;

  /**
   * Generate unique ID
   */
  protected generateId(): string {
    return `${this.tableName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log repository operation
   */
  protected logOperation(operation: string, metadata: Record<string, any>): void {
    logger.info(`Repository operation: ${operation}`, {
      repository: this.constructor.name,
      table: this.tableName,
      operation,
      ...metadata,
    });
  }

  /**
   * Handle repository errors
   */
  protected handleError(error: unknown, message: string): void {
    logger.error(message, {
      repository: this.constructor.name,
      table: this.tableName,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  /**
   * Build pagination result
   */
  protected buildPaginationResult<TData>(
    data: TData[],
    total: number,
    limit: number,
    offset: number
  ): PaginationResult<TData> {
    const page = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  /**
   * Validate pagination parameters
   */
  protected validatePagination(limit?: number, offset?: number): { limit: number; offset: number } {
    const validLimit = Math.min(Math.max(limit || 50, 1), 100);
    const validOffset = Math.max(offset || 0, 0);
    
    return { limit: validLimit, offset: validOffset };
  }

  /**
   * Get current timestamp
   */
  protected getCurrentTimestamp(): Date {
    return new Date();
  }
}

// Export common query utilities
export const QueryUtils = {
  /**
   * Build ORDER BY clause
   */
  buildOrderBy: (orderBy = 'created_at', orderDirection: 'asc' | 'desc' = 'desc') => {
    return `ORDER BY ${orderBy} ${orderDirection.toUpperCase()}`;
  },

  /**
   * Build LIMIT and OFFSET clause
   */
  buildPagination: (limit = 50, offset = 0) => {
    return `LIMIT ${limit} OFFSET ${offset}`;
  },

  /**
   * Build WHERE clause for ID
   */
  buildWhereId: () => 'WHERE id = $1',

  /**
   * Build basic SELECT query
   */
  buildSelectQuery: (tableName: string, options: QueryOptions = {}) => {
    const { limit = 50, offset = 0, orderBy = 'created_at', orderDirection = 'desc' } = options;
    
    return `
      SELECT * FROM ${tableName}
      ${QueryUtils.buildOrderBy(orderBy, orderDirection)}
      ${QueryUtils.buildPagination(limit, offset)}
    `.trim();
  },

  /**
   * Build COUNT query
   */
  buildCountQuery: (tableName: string, whereClause?: string) => {
    return whereClause 
      ? `SELECT COUNT(*) as count FROM ${tableName} WHERE ${whereClause}`
      : `SELECT COUNT(*) as count FROM ${tableName}`;
  },

  /**
   * Build INSERT query
   */
  buildInsertQuery: (tableName: string, fields: string[]) => {
    const placeholders = fields.map((_, index) => `$${index + 1}`).join(', ');
    return `
      INSERT INTO ${tableName} (${fields.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `.trim();
  },

  /**
   * Build UPDATE query
   */
  buildUpdateQuery: (tableName: string, fields: string[]) => {
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    return `
      UPDATE ${tableName}
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `.trim();
  },

  /**
   * Build DELETE query
   */
  buildDeleteQuery: (tableName: string) => {
    return `DELETE FROM ${tableName} WHERE id = $1 RETURNING *`;
  },

  /**
   * Build EXISTS query
   */
  buildExistsQuery: (tableName: string) => {
    return `SELECT EXISTS(SELECT 1 FROM ${tableName} WHERE id = $1) as exists`;
  },
};