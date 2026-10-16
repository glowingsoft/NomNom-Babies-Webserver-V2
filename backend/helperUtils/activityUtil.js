const Activity = require("@models/Activity");

const logActivity = async ({
  user,
  userType,
  action,
  detail,
  module,
  baby = null,
  targetId = null,
  metadata = {},
}) => {
  try {
    await Activity.create({
      user,
      userType,
      action,
      detail,
      module,
      baby,
      targetId,
      metadata,
    });
  } catch (error) {
    console.error(("[logActivity] failed:", error.message));
  }
};

module.exports = { logActivity };

// Replicate this helper in given Controller:
