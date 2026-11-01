const express = require("express");
const {
  getSupportRequests,
  updateSupportStatus,
  replyToSupportRequest,
  deleteSupportRequest,
} = require("../controllers/supportController");
const createRateLimiter = require("@utils/rateLimiter");
const auth = require("@middlewares/authMiddleware");

const router = express.Router();
const supportRateLimiter = createRateLimiter("support", 10, 5);

router.get("/", supportRateLimiter, auth, getSupportRequests);
router.put("/status/:id", supportRateLimiter, auth, updateSupportStatus);
router.post("/:id/reply", supportRateLimiter, auth, replyToSupportRequest);
router.delete("/:id", supportRateLimiter, auth, deleteSupportRequest);

module.exports = router;
