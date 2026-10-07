const mongoose = require("mongoose");

const nutritionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    benefit: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports =
  mongoose.models.Nutrition || mongoose.model("Nutrition", nutritionSchema);
