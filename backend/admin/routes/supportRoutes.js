// routes/supportRoutes.js
const express = require("express");
const {
  getSupportRequests,
  updateSupportStatus,
  deleteSupportRequest,
} = require("../controllers/supportController");
const createRateLimiter = require("@utils/rateLimiter");
const auth = require("@middlewares/authMiddleware");

const router = express.Router();
const supportRateLimiter = createRateLimiter("support", 10, 5);

router.get("/", supportRateLimiter, auth, getSupportRequests);
router.put("/status/:id", supportRateLimiter, auth, updateSupportStatus);
router.delete("/:id", supportRateLimiter, auth, deleteSupportRequest);

module.exports = router;
