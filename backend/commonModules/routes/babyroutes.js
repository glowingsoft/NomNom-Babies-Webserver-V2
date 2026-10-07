const express = require("express");
const auth = require("../../middlewares/authMiddleware");
const { authorizeRoles } = require("../../middlewares/roleMiddleware");
const createRateLimiter = require("@utils/rateLimiter");

const {
  createBaby,
  getBabies,
  getBabyById,
  updateBaby,
  deleteBaby,
  switchActiveBaby,
} = require("../controllers/BabyController");

const router = express.Router();

// Define rate limiters
const createBabyRateLimiter = createRateLimiter("createBaby", 15, 15);
const updateBabyRateLimiter = createRateLimiter("updateBaby", 15, 15);
const deleteBabyRateLimiter = createRateLimiter("deleteBaby", 15, 15);
const switchBabyRateLimiter = createRateLimiter("switchActiveBaby", 15, 15);

// PUBLIC (any logged-in user)
router.get("/", auth, getBabies);
router.post("/switch-active", auth, switchBabyRateLimiter, switchActiveBaby);
router.get("/:id", auth, getBabyById);
router.post("/", auth, createBabyRateLimiter, createBaby);
router.put("/:id", auth, updateBabyRateLimiter, updateBaby);

// SUPER ADMIN ONLY
router.delete(
  "/:id",
  auth,
  /**authorizeRoles("superAdmin"),**/ deleteBabyRateLimiter,
  deleteBaby,
);

module.exports = router;
