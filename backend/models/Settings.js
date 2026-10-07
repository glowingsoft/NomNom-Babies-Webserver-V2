const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      enum: ["aboutUs", "privacyPolicy", "termsConditions"],
      required: true,
      unique: true,
    },
    title: {
      type: String,
      default: "",
    },
    content: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

const AdminSettings = mongoose.model("AdminSettings", settingsSchema);

module.exports = AdminSettings;
