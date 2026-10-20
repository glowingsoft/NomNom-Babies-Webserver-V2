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

const createStageRateLimiter = createRateLimiter("createBabyStage", 15, 15);
const updateStageRateLimiter = createRateLimiter("updateBabyStage", 15, 15);
const deleteStageRateLimiter = createRateLimiter("deleteBabyStage", 15, 15);

router.get("/", auth, getBabyStages);
router.get("/:id", auth, getBabyStageById);
router.post("/select", auth, selectBabyStage);

router.get(
  "/admin/all",
  auth,
 adminGetBabyStages,
);
router.post(
  "/",
  auth,
 createStageRateLimiter,
  createBabyStage,
);
router.put(
  "/:id",
  auth,
 updateStageRateLimiter,
  updateBabyStage,
);

router.delete(
  "/:id",
  auth,
 deleteStageRateLimiter,
  deleteBabyStage,
);

module.exports = router;
