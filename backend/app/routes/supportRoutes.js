const express = require("express");
const {
  createSupportRequest
} = require("../controllers/supportController");
const createRateLimiter = require("@utils/rateLimiter");

const router = express.Router();
const supportRateLimiter = createRateLimiter("support", 10, 5);

router.post("/", supportRateLimiter, createSupportRequest);

module.exports = router;
