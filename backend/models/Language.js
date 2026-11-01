const mongoose = require("mongoose");

const languageSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "language_title_required"],
    },
    image: {
      type: String,
      default: "",
    },
    transliteration: {
      type: String,
      default: "",
      trim: true,
      required: [true, "language_transliteration_required"],
    },
    flag: {
      type: String,
      default: "",
    },
    code: {
      type: String,
      required: [true, "language_code_required"],
      unique: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
    // App UI copy for this language ({ key: text }). English holds the full key list the app uses;
    // other languages must translate every key before they can be activated. Loaded only on request.
    translations: {
      type: Object,
      default: {},
      select: false,
    },
    // Bumped on every translations change so the app re-downloads only when something changed.
    translationsVersion: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    minimize: false,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.createdAt;
        delete ret.updatedAt;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: function (doc, ret) {
        delete ret.createdAt;
        delete ret.updatedAt;
        delete ret.__v;
        return ret;
      },
    },
  },
);

module.exports = mongoose.model("Language", languageSchema);
