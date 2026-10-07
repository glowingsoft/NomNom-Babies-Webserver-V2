const auth = require("@middlewares/authMiddleware");
const roleMiddleware = require("@middlewares/roleMiddleware");
const express = require("express");
const {
  getRecentReminders,
  getReminderDetail,
  getAllReminders,
  getReminderbyId,
  createReminder,
  updateReminder,
  deleteReminder,
} = require("@controllersCommonModules/reminderController");
const createRateLimiter = require("@utils/rateLimiter");

const router = express.Router();

const createLimiter = createRateLimiter("createReminder", 15, 15);
const updateLimiter = createRateLimiter("updateReminder", 15, 15);
const deleteLimiter = createRateLimiter("deleteReminder", 15, 15);

// APP
router.get("/recent", auth, getRecentReminders);

router.get("/:reminderId", auth, getReminderDetail);

// ADMIN
router.get("/admin/all", auth, roleMiddleware(["admin"]), getAllReminders);

router.get(
  "/admin/:reminderId",
  auth,
  roleMiddleware(["admin"]),
  getReminderbyId,
);

router.post(
  "/admin/",
  auth,
  roleMiddleware(["admin"]),
  createLimiter,
  createReminder,
);

router.put(
  "/admin/:reminderId",
  auth,
  roleMiddleware(["admin"]),
  updateLimiter,
  updateReminder,
);

router.delete(
  "/admin/:reminderId",
  auth,
  roleMiddleware(["admin"]),
  deleteLimiter,
  deleteReminder,
);

module.exports = router;
