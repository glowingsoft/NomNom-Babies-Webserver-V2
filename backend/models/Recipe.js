const mongoose = require("mongoose");

const recipeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      default: "",
    },
    icon: {
      type: String,
      default: "",
    },
    views: {
      type: Number,
      default: 0,
    },
    prepTime: {
      type: Number,
      required: true,
    },
    country: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Country",
      required: true,
    },
    babyStage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BabyStage",
      required: true,
    },
    mealType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meals",
      required: true,
    },
    nutritionTags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Nutrition",
      },
    ],
    feedingInsight: {
      type: String,
      default: "",
    },
    allergyReminder: {
      type: String,
      default: "",
    },
    ingredients: [
      {
        ingredientId: {
          type: mongoose.Schema.Types.ObjectId,
          default: () => new mongoose.Types.ObjectId(),
        },
        name: { type: String, required: true },
        quantity: { type: String, default: "" },
        icon: {
          type: String,
          default: "",
        },
        category: {
          type: String,
          default: "",
        },
      },
    ],
    method: [
      {
        step: { type: Number, required: true },
        title: { type: String, default: "", trim: true },
        instruction: { type: String, required: true },
      },
    ],
    notes: {
      type: String,
      default: "",
    },
    acceptanceLabel: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["draft", "pending", "published", "archived"],
      default: "published",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

const Recipe = mongoose.models.Recipe || mongoose.model("Recipe", recipeSchema);
module.exports = Recipe;
