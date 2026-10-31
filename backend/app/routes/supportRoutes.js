const express = require("express");
const {
  createSupportRequest
} = require("../controllers/supportController");
const createRateLimiter = require("@utils/rateLimiter");

const optionalAuth = require("@middlewares/optionalAuth");

const router = express.Router();
const supportRateLimiter = createRateLimiter("support", 10, 5);

// App users send their token (request is linked to the account); the website contact form posts anonymously.
router.post("/", supportRateLimiter, optionalAuth, createSupportRequest);

module.exports = router;
