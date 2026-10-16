const mongoose = require("mongoose");

const favoriteRecipeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    baby: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Baby",
      required: true,
      index: true,
    },

    recipe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recipe",
      required: true,
      index: true,
    },
  },

  {
    timestamps: true,
  },
);

// Prevent duplicate favorites
favoriteRecipeSchema.index({ user: 1, recipe: 1 }, { unique: true });

module.exports =
  mongoose.models.FavoriteRecipe ||
  mongoose.model("FavoriteRecipe", favoriteRecipeSchema);
