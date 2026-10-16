const { User } = require("@models/UserModel");
const Recipe = require("@models/Recipe");
const Country = require("@models/Country");
const BabyStage = require("@models/BabyStage");
const Nutrition = require("@models/Nutrition");
const SupportRequest = require("@models/SupportRequest");
const Activity = require("@models/Activity");
const { sendResponse } = require("@utils/responseUtil");
const Baby = require("@models/Baby");
const { Devices } = require("@models/Devices");
const Meals = require("@models/Meals");

// ── Widgets (stat cards) — downloads restored via Activity ──────────────
const dashboard = async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      totalCountries,
      activeCountries,
      totalRecipes,
      publishedRecipes,
      totalAgeGroups,
      activeAgeGroups,
      totalNutritionTags,
      openSupportTickets,
      totalDownloads,
    ] = await Promise.all([
      User.countDocuments({ "accountState.userType": { $ne: "admin" } }),
      User.countDocuments({
        "accountState.status": "active",
        "accountState.userType": { $ne: "admin" },
      }),
      User.countDocuments({
        "accountState.status": "inactive",
        "accountState.userType": { $ne: "admin" },
      }),
      Country.countDocuments(),
      Country.countDocuments({ status: "active", isEnabled: true }),
      Recipe.countDocuments(),
      Recipe.countDocuments({ status: "published" }),
      BabyStage.countDocuments(),
      BabyStage.countDocuments({ active: true }),
      Nutrition.countDocuments(),
      SupportRequest.countDocuments({ status: { $in: ["pending", "open"] } }),
      Activity.countDocuments({ action: "download" }),
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: {
        widgets: {
          totalUsers,
          activeUsers,
          inactiveUsers,
          totalCountries,
          activeCountries,
          totalRecipes,
          publishedRecipes,
          totalAgeGroups,
          activeAgeGroups,
          totalNutritionTags,
          openSupportTickets,
          downloadedResources: totalDownloads,
        },
      },
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server_error",
      error: error.message,
    });
  }
};

// ── User status donut (Active / Inactive / Suspended) ──────────────────
const userStatusStats = async (req, res) => {
  try {
    const [active, inactive, suspended] = await Promise.all([
      User.countDocuments({
        "accountState.status": "active",
        "accountState.userType": { $ne: "admin" },
      }),
      User.countDocuments({
        "accountState.status": "inactive",
        "accountState.userType": { $ne: "admin" },
      }),
      User.countDocuments({
        "accountState.status": "suspended",
        "accountState.userType": { $ne: "admin" },
      }),
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: {
        active,
        inactive,
        suspended,
        total: active + inactive + suspended,
      },
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};

// ── Platform health radial (unchanged) ──────────────────────────────────
const platformHealth = async (req, res) => {
  try {
    const [
      totalCountries,
      activeCountries,
      totalAgeGroups,
      activeAgeGroups,
      totalRecipes,
      publishedRecipes,
    ] = await Promise.all([
      Country.countDocuments(),
      Country.countDocuments({ status: "active", isEnabled: true }),
      BabyStage.countDocuments(),
      BabyStage.countDocuments({ active: true }),
      Recipe.countDocuments(),
      Recipe.countDocuments({ status: "published" }),
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      data: {
        countriesRate:
          totalCountries > 0
            ? Math.round((activeCountries / totalCountries) * 100)
            : 0,
        ageGroupsRate:
          totalAgeGroups > 0
            ? Math.round((activeAgeGroups / totalAgeGroups) * 100)
            : 0,
        recipesRate:
          totalRecipes > 0
            ? Math.round((publishedRecipes / totalRecipes) * 100)
            : 0,
      },
    });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, error: error.message });
  }
};

// ── Platform growth bar chart — downloads series restored ────────────────
const platformGrowthTrend = async (req, res) => {
  try {
    const months = [];
    const now = new Date();

    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        label: d.toLocaleString("en-US", { month: "short" }),
        start: new Date(d.getFullYear(), d.getMonth(), 1),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 1),
      });
    }

    const rangeStart = months[0].start;

    const [userDocs, recipeDocs, downloadDocs] = await Promise.all([
      User.find({
        createdAt: { $gte: rangeStart },
        "accountState.userType": { $ne: "admin" },
      }).select("createdAt"),
      Recipe.find({ createdAt: { $gte: rangeStart } }).select("createdAt"),
      Activity.find({
        action: "download",
        createdAt: { $gte: rangeStart },
      }).select("createdAt"),
    ]);

    const bucket = (docs) =>
      months.map(
        (m) =>
          docs.filter((d) => d.createdAt >= m.start && d.createdAt < m.end)
            .length,
      );

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: {
        months: months.map((m) => m.label),
        series: [
          { name: "Users", data: bucket(userDocs) },
          { name: "Recipes", data: bucket(recipeDocs) },
          { name: "Downloads", data: bucket(downloadDocs) },
        ],
      },
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};


// ── Recent activities (limit param) ──────────────────────────────────────
const recentActivities = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 5;

    const activities = await Activity.find()
      .populate("user", "_id name email")
      .sort({ createdAt: -1 })
      .limit(limit);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: activities,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};

const topDownloadedRecipes = async (req, res) => {
  try {
    const results = await Activity.aggregate([
      {
        $match: {
          action: "download",
          module: "recipe",
          targetId: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$targetId",
          title: { $first: "$metadata.recipeTitle" },
          mealType: { $first: "$metadata.mealType" },
          downloads: { $sum: 1 },
        },
      },
      { $sort: { downloads: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: Meals.collection.name,
          localField: "mealType",
          foreignField: "_id",
          as: "mealType",
        },
      },
      {
        $unwind: {
          path: "$mealType",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          recipeId: "$_id",
          title: 1,
          mealType: {
            _id: "$mealType._id",
            name: "$mealType.name",
          },
          downloads: 1,
        },
      },
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: results,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};

const downloadsByType = async (req, res) => {
  try {
    const results = await Activity.aggregate([
      { $match: { action: "download" } },
      { $group: { _id: "$module", downloads: { $sum: 1 } } },
      { $project: { _id: 0, module: "$_id", downloads: 1 } },
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: results,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};

// ── Top viewed recipes (unchanged) ───────────────────────────────────────
const topViewedRecipes = async (req, res) => {
  try {
    const recipes = await Recipe.find({ status: "published" })
      .populate("country", "_id name")
      .populate("mealType", "_id name")
      .sort({ views: -1 })
      .limit(10)
      .select("title mealType views");

    return sendResponse({ res, statusCode: 200, data: recipes });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, error: error.message });
  }
};

// ── Most selected countries (unchanged) ──────────────────────────────────
const topCountries = async (req, res) => {
  try {
    const countries = await Baby.aggregate([
      { $match: { "selectedCountries.0": { $exists: true } } },
      { $unwind: "$selectedCountries" },
      { $group: { _id: "$selectedCountries", users: { $sum: 1 } } },
      { $sort: { users: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "countries",
          localField: "_id",
          foreignField: "_id",
          as: "country",
        },
      },
      { $unwind: "$country" },
      {
        $project: {
          _id: 0,
          countryId: "$country._id",
          name: "$country.name",
          flag: "$country.flag",
          users: 1,
        },
      },
    ]);
    const totalSelections = countries.reduce((sum, c) => sum + c.users, 0);
    const result = countries.map((c) => ({
      ...c,
      selectionRate:
        totalSelections > 0
          ? Number(((c.users / totalSelections) * 100).toFixed(1))
          : 0,
    }));
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: result,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};

// New — country growth over time
const getCountryGrowth = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || req.params.limit || 5, 10);

    // top N countries by baby count, to keep the line chart readable
    const topN = await Baby.aggregate([
      { $match: { "selectedCountries.0": { $exists: true } } },
      { $unwind: "$selectedCountries" },
      { $group: { _id: "$selectedCountries", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);
    const topCountryIds = topN.map((c) => c._id);

    const monthly = await Baby.aggregate([
      { $match: { selectedCountries: { $in: topCountryIds } } },
      { $unwind: "$selectedCountries" },
      { $match: { selectedCountries: { $in: topCountryIds } } },
      {
        $group: {
          _id: {
            country: "$selectedCountries",
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "countries",
          localField: "_id.country",
          foreignField: "_id",
          as: "country",
        },
      },
      { $unwind: "$country" },
      {
        $group: {
          _id: "$country.name",
          monthlyData: { $push: { month: "$_id.month", count: "$count" } },
        },
      },
    ]);

    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const series = monthly.map((c) => ({
      name: c._id,
      data: months.map(
        (_, i) => c.monthlyData.find((m) => m.month === i + 1)?.count || 0,
      ),
    }));

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: { months, series },
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};

// ── App downloads (unique installs by platform: Android / iOS) ─────────
const appDownloadStats = async (req, res) => {
  try {
    const results = await Devices.aggregate([
      { $unwind: "$devices" },
      {
        $group: {
          _id: {
            deviceType: "$devices.deviceType",
            deviceId: "$devices.deviceId",
          },
        },
      },
      {
        $group: {
          _id: "$_id.deviceType",
          count: { $sum: 1 },
        },
      },
    ]);

    const counts = { android: 0, ios: 0 };

    results.forEach((r) => {
      if (counts[r._id] !== undefined) {
        counts[r._id] = r.count;
      }
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: {
        android: counts.android,
        ios: counts.ios,
        total: counts.android + counts.ios,
      },
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};

module.exports = {
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
};
