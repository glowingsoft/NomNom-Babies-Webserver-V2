const mongoose = require("mongoose");

const cartIngredientSchema = new mongoose.Schema(
  {
    ingredientId: {
      type: mongoose.Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
    },

    name: {
      type: String,
      required: true,
    },

    quantity: {
      type: String,
      default: "",
    },

    icon: {
      type: String,
      default: "",
    },

    category: {
      type: String,
      default: "",
    },

    checked: {
      type: Boolean,
      default: false,
    },

    source: {
      type: String,
      enum: ["recipe", "custom"],
      default: "recipe",
    },
  },
  {
    _id: true,
  },
);

const cartRecipeSchema = new mongoose.Schema(
  {
    recipe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recipe",
      required: true,
    },

    ingredients: [cartIngredientSchema],
  },
  {
    _id: true,
  },
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    baby: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Baby",
      required: true,
    },

    recipes: [cartRecipeSchema],
  },
  {
    timestamps: true,
  },
);

cartSchema.index(
  {
    user: 1,
    baby: 1,
  },

  {
    unique: true,
  },
);

module.exports = mongoose.models.Cart || mongoose.model("Cart", cartSchema);
