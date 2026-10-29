const express = require("express");
const {
  createSupportRequest
} = require("../controllers/supportController");
const createRateLimiter = require("@utils/rateLimiter");

const auth = require("@middlewares/authMiddleware");

const router = express.Router();
const supportRateLimiter = createRateLimiter("support", 10, 5);

// Signed-in users only, so each request is tied to an account (and logged as its activity).
router.post("/", supportRateLimiter, auth, createSupportRequest);

module.exports = router;
