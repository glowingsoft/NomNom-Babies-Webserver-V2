const express = require("express");
const auth = require("../../middlewares/authMiddleware");
const createRateLimiter = require("../../helperUtils/rateLimiter");

const {
    getNotifications,
    readNotification,
    sendTestNotification,
} = require("../../commonModules/controllers/notificationsController");

const router = express.Router();
const notificationsRateLimiter = createRateLimiter("notifications", 10, 50);

router.get("/", notificationsRateLimiter, auth, getNotifications);

router.put("/:id/read", notificationsRateLimiter, auth, readNotification);

if (process.env.NODE_ENV !== "prod") {
    router.post("/test", notificationsRateLimiter, auth, sendTestNotification);
}

module.exports = router;
