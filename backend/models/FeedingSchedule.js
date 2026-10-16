const mongoose = require("mongoose");

const feedingScheduleSchema = new mongoose.Schema(
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
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["milk", "meal"],
      required: true,
    },
    time: {
      type: String,
      required: true, // e.g. "07:00 AM"
    },
    title: {
      type: String,
      required: true, // e.g. "Morning Feed"
    },
    description: {
      type: String,
      default: "",
    },
    isOptional: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

const FeedingSchedule =
  mongoose.models.FeedingSchedule ||
  mongoose.model("FeedingSchedule", feedingScheduleSchema);

module.exports = FeedingSchedule;
