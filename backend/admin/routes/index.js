const express = require("express");
const router = express.Router();

const bulkInsertRoutes = require("./dbRoutes.js");
const adminSettingsRoutes = require("./settingsRoutes.js");
const userRoutes = require("./userRoutes.js");
const countriesRoutes = require("./countriesRoutes.js");
const languageRoutes = require("./languageRoutes.js");
const adminPanelRoutes = require("./adminPanelRoutes.js");
const activityRoutes = require("./activityRoutes.js");
const supportRoutes = require("./supportRoutes.js");

router.use("/settings", adminSettingsRoutes);
router.use("/user", userRoutes);
router.use("/countries", countriesRoutes);
router.use("/languages", languageRoutes);
router.use("/admin-panel", adminPanelRoutes);
router.use("/activities", activityRoutes);
router.use("/support", supportRoutes);
//db utils routes
router.use("/util", bulkInsertRoutes);

module.exports = router;
