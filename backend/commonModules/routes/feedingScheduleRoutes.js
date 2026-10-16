const express = require("express");
const auth = require("../../middlewares/authMiddleware");
const createRateLimiter = require("@utils/rateLimiter");

const {
  getFeedingSchedule,
  createFeedingSchedule,
  updateFeedingSchedule,
  deleteFeedingSchedule,
  toggleSlotCompletion,
  removeScheduleSlot,
  getUserFeedingSchedules,
  getUserBabyFeedingSchedule,
  startFeedingPlan,
} = require("../controllers/feedingScheduleController");

const router = express.Router();

const createLimiter = createRateLimiter("createFeedingSchedule", 15, 15);
const updateLimiter = createRateLimiter("updateFeedingSchedule", 15, 15);
const deleteLimiter = createRateLimiter("deleteFeedingSchedule", 15, 15);
const toggleLimiter = createRateLimiter("toggleSlotCompletion", 30, 15);

router.get("/", auth, getFeedingSchedule);
router.post("/", auth, createLimiter, createFeedingSchedule);
router.get("/admin/user/:userId", auth, getUserFeedingSchedules);

router.get(
  "/admin/user/:userId/baby/:babyId",
  auth,
  getUserBabyFeedingSchedule,
);
router.delete("/slot/:slotId", auth, removeScheduleSlot);
router.put("/:id", auth, updateLimiter, updateFeedingSchedule);
router.delete("/:id", auth, deleteLimiter, deleteFeedingSchedule);
router.put("/toggle/:slotId", auth, toggleLimiter, toggleSlotCompletion);
router.post("/start", auth, startFeedingPlan);

module.exports = router;
