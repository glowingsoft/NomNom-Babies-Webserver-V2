const cron = require("node-cron");
const {
  closeStalePendingRequests,
  AUTO_CLOSE_AFTER_DAYS,
} = require("@utils/supportAutoClose");

const runSupportAutoClose = async () => {
  try {
    const closed = await closeStalePendingRequests();

    if (closed > 0) {
      console.log(
        `[support] auto-closed ${closed} request(s) pending for ${AUTO_CLOSE_AFTER_DAYS}+ days`,
      );
    }
  } catch (error) {
    console.error("[support] auto-close failed:", error.message);
  }
};

const startSupportCron = () => {
  runSupportAutoClose();

  cron.schedule("0 * * * *", runSupportAutoClose);
};

module.exports = { startSupportCron, runSupportAutoClose };
