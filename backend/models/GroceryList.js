const mongoose = require("mongoose");

const groceryIngredientSchema = new mongoose.Schema({
  ingredientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },

  name: String,

  quantity: String,

  icon: {
    type: String,
    default: "",
  },

  category: String,

  checked: {
    type: Boolean,

    default: false,
  },
});

const groceryRecipeSchema = new mongoose.Schema(
  {
    recipe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recipe",
      required: true,
    },

    ingredients: [groceryIngredientSchema],
  },
  {
    _id: true,
  },
);

const groceryListSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    baby: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Baby",
      required: true,
      unique: true,
    },

    recipes: [groceryRecipeSchema],
  },
  {
    timestamps: true,
  },
);

module.exports =
  mongoose.models.GroceryList ||
  mongoose.model("GroceryList", groceryListSchema);
