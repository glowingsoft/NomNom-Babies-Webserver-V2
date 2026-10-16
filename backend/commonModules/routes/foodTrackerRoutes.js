const express = require("express");
const auth = require("@middlewares/authMiddleware");
const {
  createFoodTracker,
  getFoodTracker,
  getAllFoodTrackers,
} = require("../controllers/foodTrackerController");

const router = express.Router();

router.post("/", auth, createFoodTracker);
router.get("/baby", auth, getFoodTracker);

// ADMIN
router.get("/admin", auth, getAllFoodTrackers);

module.exports = router;
