const express = require("express");
const auth = require("../../middlewares/authMiddleware");
const { authorizeRoles } = require("../../middlewares/roleMiddleware");
const createRateLimiter = require("@utils/rateLimiter");

const {
  getNutritionByRecipe,
  adminGetNutritions,
  createNutrition,
  updateNutrition,
  deleteNutrition,
  getNutrition,
} = require("../controllers/nutritionController");
const roleMiddleware = require("../../middlewares/roleMiddleware");

const router = express.Router();

const createNutritionRateLimiter = createRateLimiter("createNutrition", 15, 15);
const updateNutritionRateLimiter = createRateLimiter("updateNutrition", 15, 15);
const deleteNutritionRateLimiter = createRateLimiter("deleteNutrition", 15, 15);

// ─── PUBLIC (logged-in users) ─────────────────────────────────────────────────

router.get("/recipe/:recipeId", auth, getNutritionByRecipe);
router.get("/baby", auth, getNutrition);

// ───ADMIN ─────────────────────────────────────────────

router.get("/admin/all", auth, roleMiddleware(["admin"]), adminGetNutritions);
router.post("/admin", auth, roleMiddleware(["admin"]), createNutritionRateLimiter, createNutrition);
router.put("/admin/:id", auth, roleMiddleware(["admin"]), updateNutritionRateLimiter, updateNutrition);

router.delete("/admin/:id", auth, roleMiddleware(["admin"]), deleteNutritionRateLimiter, deleteNutrition);

module.exports = router;
