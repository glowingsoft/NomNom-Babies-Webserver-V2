const express = require("express");
const auth = require("../../middlewares/authMiddleware");
const { authorizeRoles } = require("../../middlewares/roleMiddleware");
const createRateLimiter = require("@utils/rateLimiter");

const {
  getBabyStages,
  getBabyStageById,
  selectBabyStage,
  adminGetBabyStages,
  createBabyStage,
  updateBabyStage,
  deleteBabyStage,
} = require("../controllers/BabyStageController");

const router = express.Router();

// Define rate limiters
const createStageRateLimiter = createRateLimiter("createBabyStage", 15, 15); // 15 requests per 15 minutes
const updateStageRateLimiter = createRateLimiter("updateBabyStage", 15, 15); // 15 requests per 15 minutes
const deleteStageRateLimiter = createRateLimiter("deleteBabyStage", 15, 15); // 15 requests per 15 minutes

// PUBLIC (any logged-in user)
router.get("/", auth, getBabyStages);
router.get("/:id", auth, getBabyStageById);
router.post("/select", auth, selectBabyStage);

//  CONTENT ADMIN + SUPER ADMIN
router.get(
  "/admin/all",
  auth,
  /**authorizeRoles("contentAdmin", "superAdmin"),**/ adminGetBabyStages,
);
router.post(
  "/",
  auth,
  /**authorizeRoles("contentAdmin", "superAdmin"),**/ createStageRateLimiter,
  createBabyStage,
);
router.put(
  "/:id",
  auth,
  /**authorizeRoles("contentAdmin", "superAdmin"),**/ updateStageRateLimiter,
  updateBabyStage,
);

// SUPER ADMIN ONLY
router.delete(
  "/:id",
  auth,
  /**authorizeRoles("superAdmin"),**/ deleteStageRateLimiter,
  deleteBabyStage,
);

module.exports = router;
