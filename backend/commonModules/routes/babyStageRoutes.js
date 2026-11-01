const express = require("express");
const auth = require("../../middlewares/authMiddleware");
const roleMiddleware = require("../../middlewares/roleMiddleware");
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

// Managing stages is admin-only (app users only read and select them).
const adminOnly = roleMiddleware(["admin"]);
router.get("/admin/all", auth, adminOnly, adminGetBabyStages);
router.post("/", auth, adminOnly, createStageRateLimiter, createBabyStage);
router.put("/:id", auth, adminOnly, updateStageRateLimiter, updateBabyStage);
router.delete("/:id", auth, adminOnly, deleteStageRateLimiter, deleteBabyStage);

module.exports = router;
