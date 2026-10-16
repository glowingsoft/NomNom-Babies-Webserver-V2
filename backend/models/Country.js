const mongoose = require("mongoose");

const countrySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Country name is required"],
      trim: true,
    },
    code: {
      type: String,
      required: [true, "Country code is required"],
      trim: true,
      uppercase: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ["active", "review", "disabled"],
      default: "active",
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    signatureFoods: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Country", countrySchema);
