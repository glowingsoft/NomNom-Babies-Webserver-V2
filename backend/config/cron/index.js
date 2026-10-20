const cron = require("node-cron");
const { acquireLock, releaseLock } = require("../redis/redisCache");

const { runEventReminderCron } = require("./events/eventReminder.cron");
const { startSupportCron } = require("./support.cron");
const startCrons = () => {
  startSupportCron();

  cron.schedule("* * * * *", async () => {
    const lockKey = "cron:event-reminders";
    const lock = await acquireLock(lockKey, 50);

    if (!lock) return;

    try {
    } catch (err) {
      console.error("Reminder cron error:", err);
    } finally {
      await releaseLock(lockKey, lock);
    }
  });

};

module.exports = { startCrons };
