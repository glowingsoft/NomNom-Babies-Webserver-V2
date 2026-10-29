const { User } = require("@models/UserModel");
const { Devices } = require("@models/Devices");
const { userCache } = require("@config/nodeCache");

const DELETED_STATUS = "softDeleted";

/**
 * Deletes an account so it can never be signed back into: the email, password, phone and every social
 * provider id are cleared (originals kept in `deletionMeta` for audit), devices are dropped and the cached
 * session is evicted. Signing up / social sign-in again with the same email creates a brand-new, empty account.
 */
const hardDeleteUserById = async (userId) => {
  const user = await User.findById(userId).select(
    "email phoneNumber provider googleId facebookId appleId accountState",
  );

  if (!user) return null;

  if (user.accountState?.status === DELETED_STATUS) {
    userCache.del(String(userId));
    return { alreadyDeleted: true };
  }

  await User.findByIdAndUpdate(userId, {
    $set: {
      email: `deleted_user_${userId}_${Date.now()}@example.com`,
      previousEmail: user.email,
      password: "",
      phoneNumber: "",
      profileIcon: "",
      provider: "email",
      googleId: null,
      facebookId: null,
      appleId: null,
      resetToken: "",
      activeBaby: null,
      "accountState.status": DELETED_STATUS,
      "accountState.finalDeletionDate": new Date(),
      deletionMeta: {
        deletedAt: new Date(),
        previousEmail: user.email,
        previousPhoneNumber: user.phoneNumber || "",
        previousProvider: user.provider || "email",
      },
    },
  });

  await Devices.updateOne({ userId }, { $set: { devices: [] } });
  userCache.del(String(userId));

  return { alreadyDeleted: false };
};

module.exports = { hardDeleteUserById, DELETED_STATUS };
