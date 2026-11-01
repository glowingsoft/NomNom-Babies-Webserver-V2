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
    isOptional: {
      type: Boolean,
      default: false,
    },
    // Minutes after midnight, derived from `time`; slots sort by this (sorting "hh:mm A" strings is wrong).
    timeMinutes: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true },
);

/** "7:00 AM" / "07:00 PM" / "19:00" → minutes after midnight (null if unparseable). */
const toMinutes = (time) => {
  const m = String(time || "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;
  let hours = Number(m[1]) % (m[3] ? 12 : 24);
  if (m[3] && m[3].toUpperCase() === "PM") hours += 12;
  return hours * 60 + Number(m[2]);
};

feedingScheduleSchema.pre("save", function setTimeMinutes(next) {
  if (this.isModified("time") || this.timeMinutes == null) {
    this.timeMinutes = toMinutes(this.time);
  }
  next();
});

feedingScheduleSchema.statics.toMinutes = toMinutes;

const FeedingSchedule =
  mongoose.models.FeedingSchedule ||
  mongoose.model("FeedingSchedule", feedingScheduleSchema);

module.exports = FeedingSchedule;
