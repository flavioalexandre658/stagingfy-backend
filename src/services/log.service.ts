import { BaseService, ServiceResponse } from './base.service';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  id?: string;
  level: LogLevel;
  message: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
  stack?: string;
  source?: string;
}

export interface LogQuery {
  level?: LogLevel;
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  source?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface LogStats {
  totalLogs: number;
  errorCount: number;
  warnCount: number;
  infoCount: number;
  debugCount: number;
  fatalCount: number;
  errorRate: number;
  topSources: Array<{ source: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
}

/**
 * Service for centralized logging with support for different levels and metadata
 */
export class LogService extends BaseService {
  private logs: LogEntry[] = [];
  private maxLogs = 10000; // Keep last 10k logs in memory

  /**
   * Log a debug message
   */
  async debug(
    message: string, 
    metadata?: Record<string, any>, 
    context?: { userId?: string; sessionId?: string; requestId?: string; source?: string }
  ): Promise<ServiceResponse<boolean>> {
    return this.log('debug', message, metadata, context);
  }

  /**
   * Log an info message
   */
  async info(
    message: string, 
    metadata?: Record<string, any>, 
    context?: { userId?: string; sessionId?: string; requestId?: string; source?: string }
  ): Promise<ServiceResponse<boolean>> {
    return this.log('info', message, metadata, context);
  }

  /**
   * Log a warning message
   */
  async warn(
    message: string, 
    metadata?: Record<string, any>, 
    context?: { userId?: string; sessionId?: string; requestId?: string; source?: string }
  ): Promise<ServiceResponse<boolean>> {
    return this.log('warn', message, metadata, context);
  }

  /**
   * Log an error message
   */
  async error(
    message: string, 
    error?: Error, 
    metadata?: Record<string, any>, 
    context?: { userId?: string; sessionId?: string; requestId?: string; source?: string }
  ): Promise<ServiceResponse<boolean>> {
    const logMetadata = {
      ...metadata,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    };

    return this.log('error', message, logMetadata, context, error?.stack);
  }

  /**
   * Log a fatal error message
   */
  async fatal(
    message: string, 
    error?: Error, 
    metadata?: Record<string, any>, 
    context?: { userId?: string; sessionId?: string; requestId?: string; source?: string }
  ): Promise<ServiceResponse<boolean>> {
    const logMetadata = {
      ...metadata,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    };

    return this.log('fatal', message, logMetadata, context, error?.stack);
  }

  /**
   * Generic log method
   */
  private async log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
    context?: { userId?: string; sessionId?: string; requestId?: string; source?: string },
    stack?: string
  ): Promise<ServiceResponse<boolean>> {
    try {
      this.validateRequired({ level, message }, ['level', 'message']);

      const logEntry: LogEntry = {
        id: this.generateId(),
        level,
        message,
        timestamp: new Date(),
      };

      if (context?.userId) logEntry.userId = context.userId;
      if (context?.sessionId) logEntry.sessionId = context.sessionId;
      if (context?.requestId) logEntry.requestId = context.requestId;
      if (context?.source) logEntry.source = context.source;
      if (metadata) logEntry.metadata = metadata;
      if (stack) logEntry.stack = stack;

      // Add to in-memory logs
      this.logs.push(logEntry);

      // Keep only the last maxLogs entries
      if (this.logs.length > this.maxLogs) {
        this.logs = this.logs.slice(-this.maxLogs);
      }

      // Log to console based on level
      this.logToConsole(logEntry);

      // TODO: Send to external logging service (Logtail, etc.)
      await this.sendToExternalService(logEntry);

      return this.createResponse(true, 'Log entry created');
    } catch (error) {
      // Fallback to console.error to avoid infinite loop
      console.error('Failed to create log entry:', error);
      return this.createResponse(false, 'Failed to create log entry');
    }
  }

  /**
   * Query logs with filters
   */
  async queryLogs(query: LogQuery = {}): Promise<ServiceResponse<LogEntry[]>> {
    try {
      let filteredLogs = [...this.logs];

      // Filter by level
      if (query.level) {
        filteredLogs = filteredLogs.filter(log => log.level === query.level);
      }

      // Filter by date range
      if (query.startDate) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= query.startDate!);
      }
      if (query.endDate) {
        filteredLogs = filteredLogs.filter(log => log.timestamp <= query.endDate!);
      }

      // Filter by user
      if (query.userId) {
        filteredLogs = filteredLogs.filter(log => log.userId === query.userId);
      }

      // Filter by session
      if (query.sessionId) {
        filteredLogs = filteredLogs.filter(log => log.sessionId === query.sessionId);
      }

      // Filter by request
      if (query.requestId) {
        filteredLogs = filteredLogs.filter(log => log.requestId === query.requestId);
      }

      // Filter by source
      if (query.source) {
        filteredLogs = filteredLogs.filter(log => log.source === query.source);
      }

      // Search in message
      if (query.search) {
        const searchLower = query.search.toLowerCase();
        filteredLogs = filteredLogs.filter(log => 
          log.message.toLowerCase().includes(searchLower) ||
          JSON.stringify(log.metadata || {}).toLowerCase().includes(searchLower)
        );
      }

      // Sort by timestamp (newest first)
      filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Apply pagination
      const offset = query.offset || 0;
      const limit = query.limit || 100;
      const paginatedLogs = filteredLogs.slice(offset, offset + limit);

      this.logOperation('queryLogs', { 
        totalFound: filteredLogs.length, 
        returned: paginatedLogs.length,
        query 
      });

      return this.createResponse(paginatedLogs);
    } catch (error) {
      this.handleError(error, 'Failed to query logs');
    }
  }

  /**
   * Get log statistics
   */
  async getLogStats(
    startDate?: Date, 
    endDate?: Date
  ): Promise<ServiceResponse<LogStats>> {
    try {
      let logs = [...this.logs];

      // Filter by date range
      if (startDate) {
        logs = logs.filter(log => log.timestamp >= startDate);
      }
      if (endDate) {
        logs = logs.filter(log => log.timestamp <= endDate);
      }

      const totalLogs = logs.length;
      const errorCount = logs.filter(log => log.level === 'error').length;
      const warnCount = logs.filter(log => log.level === 'warn').length;
      const infoCount = logs.filter(log => log.level === 'info').length;
      const debugCount = logs.filter(log => log.level === 'debug').length;
      const fatalCount = logs.filter(log => log.level === 'fatal').length;

      const errorRate = totalLogs > 0 ? (errorCount + fatalCount) / totalLogs : 0;

      // Top sources
      const sourceCount: Record<string, number> = {};
      logs.forEach(log => {
        if (log.source) {
          sourceCount[log.source] = (sourceCount[log.source] || 0) + 1;
        }
      });
      const topSources = Object.entries(sourceCount)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Top users
      const userCount: Record<string, number> = {};
      logs.forEach(log => {
        if (log.userId) {
          userCount[log.userId] = (userCount[log.userId] || 0) + 1;
        }
      });
      const topUsers = Object.entries(userCount)
        .map(([userId, count]) => ({ userId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const stats: LogStats = {
        totalLogs,
        errorCount,
        warnCount,
        infoCount,
        debugCount,
        fatalCount,
        errorRate: Math.round(errorRate * 100) / 100,
        topSources,
        topUsers,
      };

      this.logOperation('getLogStats', { 
        totalLogs, 
        errorRate: stats.errorRate,
        dateRange: { startDate, endDate }
      });

      return this.createResponse(stats);
    } catch (error) {
      this.handleError(error, 'Failed to get log stats');
    }
  }

  /**
   * Clear old logs
   */
  async clearOldLogs(olderThan: Date): Promise<ServiceResponse<number>> {
    try {
      this.validateRequired({ olderThan }, ['olderThan']);

      const initialCount = this.logs.length;
      this.logs = this.logs.filter(log => log.timestamp > olderThan);
      const clearedCount = initialCount - this.logs.length;

      this.logOperation('clearOldLogs', { clearedCount, olderThan });

      return this.createResponse(clearedCount, `Cleared ${clearedCount} old log entries`);
    } catch (error) {
      this.handleError(error, 'Failed to clear old logs');
    }
  }

  /**
   * Export logs to JSON
   */
  async exportLogs(query: LogQuery = {}): Promise<ServiceResponse<string>> {
    try {
      const logsResult = await this.queryLogs(query);
      const logs = logsResult.data || [];

      const exportData = {
        exportedAt: new Date().toISOString(),
        query,
        totalLogs: logs.length,
        logs,
      };

      const jsonString = JSON.stringify(exportData, null, 2);

      this.logOperation('exportLogs', { totalLogs: logs.length });

      return this.createResponse(jsonString, `Exported ${logs.length} log entries`);
    } catch (error) {
      this.handleError(error, 'Failed to export logs');
    }
  }

  /**
   * Log to console with appropriate level
   */
  private logToConsole(logEntry: LogEntry): void {
    const { level, message, timestamp, metadata, stack } = logEntry;
    const formattedMessage = `[${timestamp.toISOString()}] ${level.toUpperCase()}: ${message}`;

    switch (level) {
      case 'debug':
        console.debug(formattedMessage, metadata);
        break;
      case 'info':
        console.info(formattedMessage, metadata);
        break;
      case 'warn':
        console.warn(formattedMessage, metadata);
        break;
      case 'error':
      case 'fatal':
        console.error(formattedMessage, metadata);
        if (stack) {
          console.error('Stack trace:', stack);
        }
        break;
    }
  }

  /**
   * Send log to external service
   */
  private async sendToExternalService(logEntry: LogEntry): Promise<void> {
    try {
      // TODO: Implement integration with external logging services
      // Examples: Logtail, Datadog, New Relic, etc.
      
      // For now, just log that we would send it
      if (logEntry.level === 'error' || logEntry.level === 'fatal') {
        // Only log that we would send errors/fatals to avoid spam
        console.debug('Would send to external logging service:', {
          level: logEntry.level,
          message: logEntry.message,
          timestamp: logEntry.timestamp,
        });
      }
    } catch (error) {
      // Don't throw here to avoid infinite loops
      console.error('Failed to send log to external service:', error);
    }
  }

  /**
   * Generate unique ID for log entries
   */
  private generateId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start automatic cleanup of old logs
   */
  startCleanupInterval(intervalMs: number = 3600000): void { // 1 hour default
    setInterval(async () => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await this.clearOldLogs(oneDayAgo);
    }, intervalMs);

    this.logger.info('Log cleanup interval started', { intervalMs });
  }
}

// Export singleton instance
export const logService = new LogService();