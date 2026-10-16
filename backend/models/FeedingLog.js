const mongoose = require("mongoose");

const feedingLogSchema = new mongoose.Schema(
  {
    baby: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Baby",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: String, // "YYYY-MM-DD"
      required: true,
    },
    slotId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    completed: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// One log per slot per day per baby
feedingLogSchema.index({ baby: 1, date: 1, slotId: 1 }, { unique: true });

const FeedingLog =
  mongoose.models.FeedingLog || mongoose.model("FeedingLog", feedingLogSchema);

module.exports = FeedingLog;
