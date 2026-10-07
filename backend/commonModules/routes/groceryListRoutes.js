const {
  getGroceryList,
  addRecipeToGroceryList,
  updateGroceryItems,
  removeGroceryItem,
  clearGroceryList,
  removeRecipeFromGroceryList,
  adminGetGroceryLists,
  adminGetGroceryListById,
} = require("@controllersCommonModules/GroceryListController");
const auth = require("@middlewares/authMiddleware");
const roleMiddleware = require("@middlewares/roleMiddleware");
const createRateLimiter = require("@utils/rateLimiter");
const express = require("express");

const router = express.Router();

const addRecipeRateLimiter = createRateLimiter(
  "addRecipeToGroceryList",
  15,
  15,
);

const updateItemRateLimiter = createRateLimiter("updateGroceryItem", 15, 15);

const removeItemRateLimiter = createRateLimiter("removeGroceryItem", 15, 15);

const clearListRateLimiter = createRateLimiter("clearGroceryList", 15, 15);

router.get("/", auth, getGroceryList);

// ADMIN
router.get(
  "/admin/all",
  auth,
  roleMiddleware(["admin"]),
  adminGetGroceryLists,
);

router.get(
  "/admin/:id",
  auth,
  roleMiddleware(["admin"]),
  adminGetGroceryListById,
);

router.post("/add-recipe", auth, addRecipeRateLimiter, addRecipeToGroceryList);

router.patch("/items", auth, updateItemRateLimiter, updateGroceryItems);

// Remove Item
router.delete("/item/:itemId", auth, removeItemRateLimiter, removeGroceryItem);

// Remove Recipe from GroceryList
router.delete("/:recipeId", auth, removeRecipeFromGroceryList);

// CLear whole List
router.delete("/clear", auth, clearListRateLimiter, clearGroceryList);

module.exports = router;
