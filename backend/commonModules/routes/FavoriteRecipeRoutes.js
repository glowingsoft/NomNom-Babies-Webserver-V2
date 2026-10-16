const {
  getFavorites,
  addFavorite,
  removeFavorite,
} = require("@controllersCommonModules/FavoriteRecipeController");
const auth = require("@middlewares/authMiddleware");
const createRateLimiter = require("@utils/rateLimiter");
const express = require("express");

const router = express.Router();

const addFavoriteRateLimiter = createRateLimiter("addFavorite", 15, 15);

const removeFavorireRateLimiter = createRateLimiter("removeFavorite", 15, 15);

router.get("/", auth, getFavorites);

router.post("/:recipeId", auth, addFavoriteRateLimiter, addFavorite);

router.delete("/:recipeId", auth, removeFavorireRateLimiter, removeFavorite);

module.exports = router;
