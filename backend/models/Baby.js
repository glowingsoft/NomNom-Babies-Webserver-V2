const mongoose = require("mongoose");

const babySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    profileIcon: {
      type: String,
      default: "",
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    babyStage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BabyStage",
      default: null,
      required: true,
    },
    selectedCountries: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Country" }],
      required: true,
      default: [],
      validate: {
        validator: (val) => val.length <= 2,
        message: "max_two_countries_allowed",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },
    feedingPlanStarted: {
      type: Boolean,
      default: false,
    },

    feedingPlanStartedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

const Baby = mongoose.models.Baby || mongoose.model("Baby", babySchema);

module.exports = Baby;
