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
const { lookupOne } = require("@utils/aggregationUtil");

const getDashboardCounts = async () => {
  const [
    totalUsers,
    activeUsers,
    inactiveUsers,
    suspendedUsers,
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
    User.countDocuments({
      "accountState.status": "suspended",
      "accountState.userType": { $ne: "admin" },
    }),
    Country.countDocuments(),
    Country.countDocuments({ status: "active", isEnabled: true }),
    Recipe.countDocuments(),
    Recipe.countDocuments({ status: "published" }),
    BabyStage.countDocuments(),
    BabyStage.countDocuments({ active: true }),
    Nutrition.countDocuments(),
    SupportRequest.countDocuments({ status: "open" }),
    Activity.countDocuments({ action: "download" }),
  ]);

  return {
    totalUsers,
    activeUsers,
    inactiveUsers,
    suspendedUsers,
    totalCountries,
    activeCountries,
    totalRecipes,
    publishedRecipes,
    totalAgeGroups,
    activeAgeGroups,
    totalNutritionTags,
    openSupportTickets,
    totalDownloads,
  };
};

const buildWidgets = (c) => ({
  totalUsers: c.totalUsers,
  activeUsers: c.activeUsers,
  inactiveUsers: c.inactiveUsers,
  totalCountries: c.totalCountries,
  activeCountries: c.activeCountries,
  totalRecipes: c.totalRecipes,
  publishedRecipes: c.publishedRecipes,
  totalAgeGroups: c.totalAgeGroups,
  activeAgeGroups: c.activeAgeGroups,
  totalNutritionTags: c.totalNutritionTags,
  openSupportTickets: c.openSupportTickets,
  downloadedResources: c.totalDownloads,
});

const buildUserStatus = (c) => ({
  active: c.activeUsers,
  inactive: c.inactiveUsers,
  suspended: c.suspendedUsers,
  total: c.activeUsers + c.inactiveUsers + c.suspendedUsers,
});

const buildPlatformHealth = (c) => ({
  countriesRate:
    c.totalCountries > 0
      ? Math.round((c.activeCountries / c.totalCountries) * 100)
      : 0,
  ageGroupsRate:
    c.totalAgeGroups > 0
      ? Math.round((c.activeAgeGroups / c.totalAgeGroups) * 100)
      : 0,
  recipesRate:
    c.totalRecipes > 0
      ? Math.round((c.publishedRecipes / c.totalRecipes) * 100)
      : 0,
});

const getGrowthTrend = async () => {
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
    })
      .select("createdAt")
      .lean(),
    Recipe.find({ createdAt: { $gte: rangeStart } })
      .select("createdAt")
      .lean(),
    Activity.find({
      action: "download",
      createdAt: { $gte: rangeStart },
    })
      .select("createdAt")
      .lean(),
  ]);

  const bucket = (docs) =>
    months.map(
      (m) =>
        docs.filter((d) => d.createdAt >= m.start && d.createdAt < m.end)
          .length,
    );

  return {
    months: months.map((m) => m.label),
    series: [
      { name: "Users", data: bucket(userDocs) },
      { name: "Recipes", data: bucket(recipeDocs) },
      { name: "Downloads", data: bucket(downloadDocs) },
    ],
  };
};

const minimizeEmptyObjects = (value) => {
  if (!value || value.constructor !== Object) return value;
  for (const key of Object.keys(value)) {
    const child = minimizeEmptyObjects(value[key]);
    if (child === undefined) delete value[key];
    else value[key] = child;
  }
  return Object.keys(value).length ? value : undefined;
};

const getRecentActivities = async (limit) => {
  const activities = await Activity.aggregate([
    { $sort: { createdAt: -1 } },
    { $limit: Math.abs(limit) },
    ...lookupOne({
      from: User.collection.name,
      field: "user",
      fields: ["_id", { name: "name", default: "" }, "email"],
    }),
    {
      $addFields: {
        baby: { $ifNull: ["$baby", null] },
        targetId: { $ifNull: ["$targetId", null] },
      },
    },
  ]);

  activities.forEach((activity) => {
    if (activity.metadata === undefined) return;
    const minimized = minimizeEmptyObjects(activity.metadata);
    if (minimized === undefined) delete activity.metadata;
    else activity.metadata = minimized;
  });

  return activities;
};

const getTopDownloadedRecipes = () =>
  Activity.aggregate([
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
        downloads: { $sum: 1 },
      },
    },
    { $sort: { downloads: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: Recipe.collection.name,
        localField: "_id",
        foreignField: "_id",
        pipeline: [{ $project: { title: 1, mealType: 1 } }],
        as: "recipe",
      },
    },
    { $unwind: { path: "$recipe", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: Meals.collection.name,
        localField: "recipe.mealType",
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
        title: { $ifNull: ["$title", "$recipe.title"] },
        mealType: {
          _id: "$mealType._id",
          name: "$mealType.name",
        },
        downloads: 1,
      },
    },
  ]);

const getDownloadsByType = () =>
  Activity.aggregate([
    { $match: { action: "download" } },
    { $group: { _id: "$module", downloads: { $sum: 1 } } },
    { $sort: { downloads: -1, _id: 1 } },
    { $project: { _id: 0, module: "$_id", downloads: 1 } },
  ]);

const getTopViewedRecipes = () => {
  const refField = (field) => ({
    $cond: [
      { $ifNull: [`$${field}._id`, false] },
      { _id: `$${field}._id`, name: `$${field}.name` },
      null,
    ],
  });

  return Recipe.aggregate([
    { $match: { status: "published" } },
    { $addFields: { views: { $ifNull: ["$views", 0] } } },
    { $sort: { views: -1, createdAt: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: Country.collection.name,
        localField: "country",
        foreignField: "_id",
        as: "country",
      },
    },
    { $unwind: { path: "$country", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: Meals.collection.name,
        localField: "mealType",
        foreignField: "_id",
        as: "mealType",
      },
    },
    { $unwind: { path: "$mealType", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        title: 1,
        views: 1,
        country: refField("country"),
        mealType: refField("mealType"),
      },
    },
  ]);
};

const getTopCountries = async () => {
  const countries = await Baby.aggregate([
    { $match: { "selectedCountries.0": { $exists: true } } },
    { $unwind: "$selectedCountries" },
    { $group: { _id: "$selectedCountries", users: { $sum: 1 } } },
    { $sort: { users: -1, _id: 1 } },
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
  return countries.map((c) => ({
    ...c,
    selectionRate:
      totalSelections > 0
        ? Number(((c.users / totalSelections) * 100).toFixed(1))
        : 0,
  }));
};

const getCountryGrowthData = async (limit) => {
  const topN = await Baby.aggregate([
    { $match: { "selectedCountries.0": { $exists: true } } },
    { $unwind: "$selectedCountries" },
    { $group: { _id: "$selectedCountries", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
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
        countryId: { $first: "$country._id" },
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
  const rank = (c) => topCountryIds.findIndex((id) => id.equals(c.countryId));
  monthly.sort((a, b) => rank(a) - rank(b));

  const series = monthly.map((c) => ({
    name: c._id,
    data: months.map(
      (_, i) => c.monthlyData.find((m) => m.month === i + 1)?.count || 0,
    ),
  }));

  return { months, series };
};

const getAppDownloads = async () => {
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

  return {
    android: counts.android,
    ios: counts.ios,
    total: counts.android + counts.ios,
  };
};

const makeHandler =
  (getData, { successKey, errorKey } = {}) =>
  async (req, res) => {
    try {
      const data = await getData(req);

      return sendResponse({
        res,
        statusCode: 200,
        translationKey: successKey,
        data,
      });
    } catch (error) {
      return sendResponse({
        res,
        statusCode: 500,
        translationKey: errorKey,
        error: error.message,
      });
    }
  };

const dashboard = makeHandler(
  async () => ({ widgets: buildWidgets(await getDashboardCounts()) }),
  {
    successKey: "data_fetched_successfully",
    errorKey: "internal_server_error",
  },
);

const userStatusStats = makeHandler(
  async () => buildUserStatus(await getDashboardCounts()),
  { successKey: "data_fetched_successfully", errorKey: "internal_server" },
);

const platformHealth = makeHandler(async () =>
  buildPlatformHealth(await getDashboardCounts()),
);

const platformGrowthTrend = makeHandler(() => getGrowthTrend(), {
  successKey: "data_fetched_successfully",
  errorKey: "internal_server",
});

const recentActivities = makeHandler(
  (req) => getRecentActivities(parseInt(req.query.limit, 10) || 5),
  { successKey: "data_fetched_successfully", errorKey: "internal_server" },
);

const topDownloadedRecipes = makeHandler(() => getTopDownloadedRecipes(), {
  successKey: "data_fetched_successfully",
  errorKey: "internal_server",
});

const downloadsByType = makeHandler(() => getDownloadsByType(), {
  successKey: "data_fetched_successfully",
  errorKey: "internal_server",
});

const topViewedRecipes = makeHandler(() => getTopViewedRecipes());

const topCountries = makeHandler(() => getTopCountries(), {
  successKey: "data_fetched_successfully",
  errorKey: "internal_server",
});

const getCountryGrowth = makeHandler(
  (req) =>
    getCountryGrowthData(
      parseInt(req.query.limit || req.params.limit || 5, 10),
    ),
  { successKey: "data_fetched_successfully", errorKey: "internal_server" },
);

const appDownloadStats = makeHandler(() => getAppDownloads(), {
  successKey: "data_fetched_successfully",
  errorKey: "internal_server",
});

const dashboardAll = async (req, res) => {
  const countryGrowthLimit = parseInt(req.query.topN, 10) || 5;
  const activitiesLimit = parseInt(req.query.limit, 10) || 5;

  const counts = getDashboardCounts();

  const sections = {
    widgets: counts.then(buildWidgets),
    userStatus: counts.then(buildUserStatus),
    platformHealth: counts.then(buildPlatformHealth),
    growthTrend: getGrowthTrend(),
    countryGrowth: getCountryGrowthData(countryGrowthLimit),
    recentActivities: getRecentActivities(activitiesLimit),
    topDownloadedRecipes: getTopDownloadedRecipes(),
    downloadsByType: getDownloadsByType(),
    topRecipes: getTopViewedRecipes(),
    topCountries: getTopCountries(),
    appDownloads: getAppDownloads(),
  };

  const data = {};
  const errors = {};

  await Promise.all(
    Object.entries(sections).map(async ([key, promise]) => {
      try {
        data[key] = await promise;
      } catch (error) {
        data[key] = null;
        errors[key] = error.message;
      }
    }),
  );

  const ordered = Object.fromEntries(
    Object.keys(sections).map((key) => [key, data[key]]),
  );

  return sendResponse({
    res,
    statusCode: 200,
    translationKey: "data_fetched_successfully",
    data: Object.keys(errors).length ? { ...ordered, errors } : ordered,
  });
};

module.exports = {
  dashboard,
  dashboardAll,
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
