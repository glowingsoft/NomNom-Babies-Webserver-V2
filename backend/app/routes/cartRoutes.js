const auth = require("@middlewares/authMiddleware");
const express = require("express");
const {
  getCartRecipes,
  getCartRecipeDetail,
  addIngredient,
  toggleIngredient,
  removeIngredient,
  markAllDone,
  deleteRecipeCart,
} = require("../controllers/cartController");

const router = express.Router();

router.get("/", auth, getCartRecipes);

router.get("/:recipeId", auth, getCartRecipeDetail);

router.post("/:recipeId/ingredient", auth, addIngredient);

router.put(
  "/toggle/recipe/:recipeId/ingredient/:ingredientId",
  auth,
  toggleIngredient,
);

router.delete("/:recipeId/ingredient/:ingredientId", auth, removeIngredient);

router.put("/:recipeId/mark-all", auth, markAllDone);

router.delete("/:recipeId", auth, deleteRecipeCart);

module.exports = router;
