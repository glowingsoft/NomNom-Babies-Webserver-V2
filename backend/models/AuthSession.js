const mongoose = require("mongoose");

// One row per refresh token. A sign-in starts a "family"; every refresh rotates the token, marking the old
// row used and adding a new one to the same family. Presenting a used token again means it was copied, so
// the whole family (that sign-in on every device holding it) is revoked.
const authSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    family: { type: String, required: true, index: true },
    // The row this token replaced (null for the first token of a sign-in).
    parent: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    // sha256 of the refresh token — the token itself is never stored.
    tokenHash: { type: String, required: true, unique: true },
    deviceId: { type: String, default: "" },
    deviceType: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    ip: { type: String, default: "" },
    // This token stops working at expiresAt; the family can't outlive familyExpiresAt (forced re-login).
    expiresAt: { type: Date, required: true },
    familyExpiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: "" },
  },
  { timestamps: true },
);

// Rows clean themselves up a week after their family can no longer be used.
authSessionSchema.index(
  { familyExpiresAt: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60 },
);

module.exports = mongoose.model("AuthSession", authSessionSchema);
