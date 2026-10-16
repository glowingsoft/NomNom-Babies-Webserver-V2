const mongoose = require("mongoose");

const foodIntroductionSchema = new mongoose.Schema(
  {
    baby: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Baby",
      required: true,
    },

    recipe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recipe",
      required: true,
    },

    introducedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

module.exports =
  mongoose.models.FoodIntroduction ||
  mongoose.model("FoodIntroduction", foodIntroductionSchema);
