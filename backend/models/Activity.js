const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userType: {
      type: String,
      enum: ["user", "admin"],
      required: true,
    },
    baby: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Baby",
      default: null,
    },
    action: {
      type: String,
      required: true,
    },
    detail: {
      type: String,
      required: true,
    },
    module: {
      type: String,
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

activitySchema.index({ createdAt: -1 });

const Activity =
  mongoose.models.Activity || mongoose.model("Activity", activitySchema);
module.exports = Activity;
