const express = require("express");
const router = express.Router();

const homeRoutes = require("./homeRoutes");
const usersRoutes = require("./userRoutes");
const notificationsRoutes = require("./notificationsRoutes");
const settingsRoutes = require("./settingsRoutes");
const supportRoutes = require("./supportRoutes");
const countriesRoutes = require("./countriesRoutes");
const cartRoutes = require("./cartRoutes");

router.use("/support", supportRoutes);
router.use("/settings", settingsRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/home", homeRoutes);
router.use("/users", usersRoutes);
router.use("/countries", countriesRoutes);
router.use("/cart", cartRoutes);

module.exports = router;
