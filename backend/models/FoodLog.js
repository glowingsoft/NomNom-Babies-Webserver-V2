const mongoose = require("mongoose");

const foodLogSchema = new mongoose.Schema(
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

    foodName: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      required: true,
    },

    day: {
      type: String,
      required: true,
    },

    date: {
      type: String,
      required: true,
    },

    completed: {
      type: Boolean,
      default: false,
    },

    badgeEarned: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

foodLogSchema.index(
  { user: 1, baby: 1, foodName: 1, day: 1 },
  { unique: true },
);

module.exports =
  mongoose.models.FoodLog || mongoose.model("FoodLog", foodLogSchema);
