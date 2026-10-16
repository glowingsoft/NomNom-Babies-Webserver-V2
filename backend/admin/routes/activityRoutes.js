const express = require("express");

const auth = require("@middlewares/authMiddleware");
const roleMiddleware = require("@middlewares/roleMiddleware");
const { getRecentActivities } = require("../controllers/activityController");

const router = express.Router();

router.get("/", auth, roleMiddleware(["admin"]), getRecentActivities);

module.exports = router;
