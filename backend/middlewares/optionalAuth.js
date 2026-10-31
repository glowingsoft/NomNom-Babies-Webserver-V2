const auth = require("./authMiddleware");

/** Runs the normal auth when a token is sent (and rejects a bad one); lets anonymous requests through. */
const optionalAuth = (req, res, next) =>
  req.header("Authorization") ? auth(req, res, next) : next();

module.exports = optionalAuth;
