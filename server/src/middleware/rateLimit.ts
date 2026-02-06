import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate limiter for authentication endpoints
 * Strict limit to prevent brute force attacks
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use IP address as key
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
});

/**
 * Rate limiter for write operations (POST, PUT, PATCH, DELETE)
 */
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: { error: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // Skip rate limiting for GET requests
    return req.method === 'GET';
  },
});

/**
 * Rate limiter for export endpoints
 * Lower limit to prevent abuse
 */
export const exportLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 exports per minute
  message: { error: 'Export rate limit exceeded, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for Slack endpoints
 */
export const slackLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: { error: 'Slack request rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * General API rate limiter
 * Applied to all routes as a baseline
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: 'Rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
});
