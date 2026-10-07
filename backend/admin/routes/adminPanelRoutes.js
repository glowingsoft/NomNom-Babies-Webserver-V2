const express = require("express");
const {
  dashboard,
  userStatusStats,
  platformHealth,
  platformGrowthTrend,
  recentActivities,
  topDownloadedRecipes,
  downloadsByType,
  topViewedRecipes,
  topCountries,
  getCountryGrowth,
  appDownloadStats,
} = require("../controllers/adminPanelController");
const auth = require("@middlewares/authMiddleware");
const router = express.Router();

router.get("/dashboard/widgets", auth, dashboard);
router.get("/dashboard/user-status", auth, userStatusStats);
router.get("/dashboard/platform-health", auth, platformHealth);
router.get("/dashboard/growth-trend", auth, platformGrowthTrend);
router.get("/dashboard/country-growth", auth, getCountryGrowth);
router.get("/dashboard/recent-activities", auth, recentActivities);
router.get("/dashboard/top-downloaded-recipes", auth, topDownloadedRecipes);
router.get("/dashboard/downloads-by-type", auth, downloadsByType);
router.get("/dashboard/top-recipes", auth, topViewedRecipes);
router.get("/dashboard/top-countries", auth, topCountries);
router.get("/dashboard/app-downloads", auth, appDownloadStats);

module.exports = router;
