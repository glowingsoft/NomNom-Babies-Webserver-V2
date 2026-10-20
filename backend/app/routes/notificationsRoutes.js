const express = require("express");
const auth = require("../../middlewares/authMiddleware");
const createRateLimiter = require("../../helperUtils/rateLimiter");

const {
    getNotifications,
    readNotification,
} = require("../../commonModules/controllers/notificationsController");

const router = express.Router();
const notificationsRateLimiter = createRateLimiter("notifications", 10, 50);

router.get("/", notificationsRateLimiter, auth, getNotifications);

router.put("/:id/read", notificationsRateLimiter, auth, readNotification);

module.exports = router;
