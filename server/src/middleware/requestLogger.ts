import { Request, Response, NextFunction } from 'express';

/**
 * Request logging middleware
 * Logs incoming requests and response times
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();

  // Log request
  const timestamp = new Date().toISOString();
  const method = req.method;
  const path = req.path;
  const userAgent = req.headers['user-agent'] || 'unknown';

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;

    // Color-coded status for console
    const statusColor = status >= 500 ? '\x1b[31m' : // Red for 5xx
                        status >= 400 ? '\x1b[33m' : // Yellow for 4xx
                        status >= 300 ? '\x1b[36m' : // Cyan for 3xx
                        '\x1b[32m';                  // Green for 2xx

    const reset = '\x1b[0m';

    // Only log in development or if LOG_REQUESTS is set
    if (process.env.NODE_ENV !== 'production' || process.env.LOG_REQUESTS === 'true') {
      console.log(
        `${timestamp} | ${statusColor}${status}${reset} | ${method.padEnd(7)} | ${path} | ${duration}ms`
      );
    }
  });

  next();
}

/**
 * Create an audit log entry for important actions
 */
export function createAuditEntry(
  userId: string | null,
  action: string,
  resourceType: string | null,
  resourceId: string | null,
  metadata?: Record<string, any>,
  req?: Request
) {
  return {
    userId,
    action,
    resourceType,
    resourceId,
    metadata: metadata ? JSON.stringify(metadata) : null,
    ipAddress: req?.ip || req?.socket.remoteAddress || null,
    userAgent: req?.headers['user-agent'] || null,
  };
}
