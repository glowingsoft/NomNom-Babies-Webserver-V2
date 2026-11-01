const rateLimit = require("express-rate-limit");
const { sendResponse } = require("./responseUtil");

const RATE_LIMIT_MULTIPLIER = Number(process.env.RATE_LIMIT_MULTIPLIER) || 100;

/**
 * Create a rate limiter middleware for Express routes.
 * @param {string} endpoint - The name of the endpoint (for logging purposes).
 * @param {number} [timeWindow=15] - The time window in minutes.
 * @param {number} [maxRequests=5] - The maximum number of requests allowed.
 * @param {{ strict?: boolean }} [options] - strict: use maxRequests as is (no RATE_LIMIT_MULTIPLIER) —
 *   for sign-in / OTP / password endpoints, where a loose limit would allow password guessing.
 * @returns {Function} Express middleware function for rate limiting.
 */
function createRateLimiter(endpoint, timeWindow = 10, maxRequests = 15, { strict = false } = {}) {
  if (process.env.NODE_ENV === "dev") {
    return (req, res, next) => next();
  }
  return rateLimit({
    windowMs: timeWindow * 60 * 1000,
    max: strict ? maxRequests : maxRequests * RATE_LIMIT_MULTIPLIER,
    skip: (req) => req.method === "OPTIONS",
    handler: (req, res, next, options) => {
      return sendResponse({
        res,
        statusCode: 429,
        translationKey: `Too many requests to ${endpoint}. Please try again later.`,
        error: true
      });
    },
  });
}

module.exports = createRateLimiter;
