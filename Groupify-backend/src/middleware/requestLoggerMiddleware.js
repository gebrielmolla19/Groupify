const logger = require('../utils/logger');

// Paths whose request bodies should never be logged (contain sensitive data)
const SENSITIVE_PATHS = [
  '/api/v1/auth/callback',
  '/api/v1/auth/login',
  '/api/v1/auth/refresh'
];

// Paths to skip logging entirely (very high-frequency, low-value)
const SKIP_PATHS = ['/health'];

/**
 * Strips undefined/null fields from an object for cleaner log output.
 */
function compact(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
}

/**
 * Request Logger Middleware
 *
 * Logs every HTTP request/response cycle with:
 *   - HTTP method, URL, status code
 *   - Response time in ms
 *   - Authenticated user ID (if available)
 *   - Client IP address
 *   - User-Agent
 *   - Request body size (bytes)
 *
 * Sensitive route bodies are not logged.
 * High-frequency health-check paths are skipped.
 */
const requestLoggerMiddleware = (req, res, next) => {
  if (SKIP_PATHS.includes(req.path)) {
    return next();
  }

  const startedAt = Date.now();

  // Capture response finish so we have the final status code and timing
  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const statusCode = res.statusCode;

    // Choose log level based on status code
    // 5xx → error, 4xx → warn, 3xx/2xx → http
    let level = 'http';
    if (statusCode >= 500) level = 'error';
    else if (statusCode >= 400) level = 'warn';

    const isSensitive = SENSITIVE_PATHS.some(p => req.path.startsWith(p));

    const logData = compact({
      method: req.method,
      url: req.originalUrl,
      statusCode,
      durationMs,
      userId: req.userId || (req.user ? req.user._id?.toString() : undefined),
      ip: req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      contentLength: req.headers['content-length'],
      // Only log a compact body summary for non-sensitive, non-GET routes in development
      ...(!isSensitive &&
        req.method !== 'GET' &&
        process.env.NODE_ENV === 'development' &&
        req.body &&
        Object.keys(req.body).length > 0 && {
          bodyKeys: Object.keys(req.body)
        })
    });

    logger[level](`${req.method} ${req.originalUrl} ${statusCode} ${durationMs}ms`, logData);
  });

  next();
};

module.exports = requestLoggerMiddleware;
