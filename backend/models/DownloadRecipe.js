const mongoose = require("mongoose");

const downloadRecipeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

// Prevent duplicate download
downloadRecipeSchema.index({ user: 1, recipe: 1 }, { unique: true });

module.exports =
  mongoose.models.DownloadRecipe ||
  mongoose.model("DownloadRecipe", downloadRecipeSchema);
