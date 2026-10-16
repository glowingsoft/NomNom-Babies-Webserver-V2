const auth = require("@middlewares/authMiddleware");
const express = require("express");
const {
  getFoodLogs,
  createFoodLog,
  toggleFoodLogCompletion,
} = require("@controllersCommonModules/foodLogController");
const createRateLimiter = require("@utils/rateLimiter");

const createLimiter = createRateLimiter("createFoodLog", 15, 15);
const toggleLimiter = createRateLimiter("toggleFoodLogCompletion", 30, 15);

const router = express.Router();

// APP
router.get("/", auth, getFoodLogs);

router.post("/", auth, createLimiter, createFoodLog);

router.put("/toggle/:logId", auth, toggleLimiter, toggleFoodLogCompletion);

module.exports = router;
