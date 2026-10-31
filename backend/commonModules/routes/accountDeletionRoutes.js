const express = require("express");
const createRateLimiter = require("@utils/rateLimiter");
const {
  requestDeletion,
  verifyDeletion,
  confirmDeletion,
} = require("../controllers/accountDeletionController");

// Public (no sign-in): used by the website's /delete-account page.
const router = express.Router();
const limiter = createRateLimiter("accountDeletion", 15, 10);

router.post("/request", limiter, requestDeletion);
router.post("/verify", limiter, verifyDeletion);
router.post("/confirm", limiter, confirmDeletion);

module.exports = router;
