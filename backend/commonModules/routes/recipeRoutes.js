const express = require("express");
const auth = require("../../middlewares/authMiddleware");
const { authorizeRoles } = require("../../middlewares/roleMiddleware");
const createRateLimiter = require("@utils/rateLimiter");

const {
  getRecipes,
  getRecipeById,
  adminGetRecipes,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  getBabyRecipes,
  getCustomCulturalPicks,
  adminGetRecipeById,
} = require("../controllers/RecipeController");
const roleMiddleware = require("../../middlewares/roleMiddleware");

const router = express.Router();

const createRecipeRateLimiter = createRateLimiter("createRecipe", 15, 15);
const updateRecipeRateLimiter = createRateLimiter("updateRecipe", 15, 15);
const deleteRecipeRateLimiter = createRateLimiter("deleteRecipe", 15, 15);

// PUBLIC (logged-in users)
router.get("/", auth, getRecipes);
router.get("/baby", auth, getBabyRecipes);
router.get("/cultural-picks", auth, getCustomCulturalPicks);
router.get("/:id", auth, getRecipeById);

// CONTENT ADMIN
router.get("/admin/all", auth, roleMiddleware(["admin"]), adminGetRecipes);
router.post(
  "/admin",
  auth,
  roleMiddleware(["admin"]),
  createRecipeRateLimiter,
  createRecipe,
);
router.get("/admin/:id", auth, roleMiddleware(["admin"]), adminGetRecipeById);
router.put(
  "/admin/:id",
  auth,
  roleMiddleware(["admin"]),
  updateRecipeRateLimiter,
  updateRecipe,
);
router.delete(
  "/admin/:id",
  auth,
  roleMiddleware(["admin"]),
  deleteRecipeRateLimiter,
  deleteRecipe,
);

module.exports = router;
