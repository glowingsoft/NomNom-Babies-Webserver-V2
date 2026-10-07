const mongoose = require("mongoose");

const babyStageSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "title_required"],
      trim: true,
    },
    features: [
      {
        type: String,
        trim: true,
      },
    ],
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("BabyStage", babyStageSchema);
