const auth = require("@middlewares/authMiddleware");
const roleMiddleware = require("@middlewares/roleMiddleware");
const express = require("express");
const {
  getSubscriptions,
  getSubscriptionDetail,
  createSubscription,
  updateSubscription,
  deleteSubscription,
} = require("@controllersCommonModules/subscriptionController");
const createRateLimiter = require("@utils/rateLimiter");

const router = express.Router();

const createLimiter = createRateLimiter("createSubscription", 15, 15);
const updateLimiter = createRateLimiter("updateSubscription", 15, 15);
const deleteLimiter = createRateLimiter("deleteSubscription", 15, 15);

// PUBLIC
router.get("/", auth, getSubscriptions);

router.get("/:subscriptionId", auth, getSubscriptionDetail);

// ADMIN

router.post(
  "/admin/",
  auth,
  roleMiddleware(["admin"]),
  createLimiter,
  createSubscription,
);

router.put(
  "/admin/:subscriptionId",
  auth,
  roleMiddleware(["admin"]),
  updateLimiter,
  updateSubscription,
);

router.delete(
  "/admin/:subscriptionId",
  auth,
  roleMiddleware(["admin"]),
  deleteLimiter,
  deleteSubscription,
);

module.exports = router;
