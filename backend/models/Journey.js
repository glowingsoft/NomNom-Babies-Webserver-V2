const mongoose = require("mongoose");

const journeySchema = new mongoose.Schema(
  {
    babyStage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BabyStage",
      required: true,
    },

    dayNumber: {
      type: Number,
      required: true,
    },

    title: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

module.exports =
  mongoose.models.Journey || mongoose.model("Journey", journeySchema);
