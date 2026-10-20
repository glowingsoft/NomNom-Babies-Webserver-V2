const SupportRequest = require("@models/SupportRequest");

const AUTO_CLOSE_AFTER_DAYS = 15;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Closes support requests that have stayed "pending" for 15 days.
 * "Stayed pending" is measured from updatedAt, which changes whenever the status
 * changes, so a request that was moved back to pending starts its 15 days again.
 * Safe to run repeatedly and from several servers at once.
 * @param {Date} [now]
 * @returns {Promise<number>} how many requests were closed
 */
const closeStalePendingRequests = async (now = new Date()) => {
  const cutoff = new Date(now.getTime() - AUTO_CLOSE_AFTER_DAYS * DAY_MS);

  const result = await SupportRequest.updateMany(
    { status: "pending", updatedAt: { $lte: cutoff } },
    { $set: { status: "closed" } },
  );

  return result.modifiedCount;
};

module.exports = { closeStalePendingRequests, AUTO_CLOSE_AFTER_DAYS };
