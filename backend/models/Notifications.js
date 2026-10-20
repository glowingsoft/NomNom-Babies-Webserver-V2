const mongoose = require("mongoose");

const NotificationTypes = {
  NEW_MESSAGE: "newMessage",
  SYSTEM: "system",
  REMINDER: "reminder",
  DOCUMENTS_UPDATE: "documentsUpdate",
  NEW_BABY: "newBaby",
};

const NotificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: Object.values(NotificationTypes),
    required: true,
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  objectId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  objectType: {
    type: String,
    required: true,
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  body: {
    type: String,
    required: true,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

NotificationSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const NotificationExp = mongoose.model("Notification", NotificationSchema);
module.exports = {
  NotificationExp,
};
module.exports.NotificationTypes = NotificationTypes;
