const Activity = require("@models/Activity");
const { User } = require("@models/UserModel");
const Baby = require("@models/Baby");
const { lookupOne } = require("@utils/aggregationUtil");
const {
  generateMeta,
  parsePaginationParams,
  sendResponse,
} = require("@utils/responseUtil");

const getRecentActivities = async (req, res) => {
  const { page, limit } = parsePaginationParams(req);
  const { search = "", userType, module } = req.query;

  try {
    const query = {};

    if (userType) query.userType = userType;
    if (module) query.module = module;

    if (search.trim()) {
      query.$or = [
        { action: { $regex: search.trim(), $options: "i" } },
        { detail: { $regex: search.trim(), $options: "i" } },
        { module: { $regex: search.trim(), $options: "i" } },
      ];
    }

    const castedQuery = Activity.find(query).cast(Activity);

    const [activities, totalRecords] = await Promise.all([
      Activity.aggregate([
        { $match: castedQuery },
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        ...lookupOne({
          from: User.collection.name,
          field: "user",
          fields: ["_id", "name", "userType"],
        }),
        ...lookupOne({
          from: Baby.collection.name,
          field: "baby",
          fields: ["_id", "name"],
        }),
        {
          $addFields: {
            metadata: {
              $cond: [
                { $eq: [{ $type: "$metadata" }, "missing"] },
                {},
                "$metadata",
              ],
            },
          },
        },
      ]),
      Activity.countDocuments(query),
    ]);

    const data = activities.map((activity, index) => ({
      id: activity._id,
      sr: (page - 1) * limit + index + 1,
      action: activity.action,
      detail: activity.detail,
      module: activity.module,
      metadata: activity.metadata,
      time: activity.createdAt,
      userType: activity.userType,
      userName: activity.user?.name || null,
      babyName: activity.baby?.name || null,
    }));

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data,
      meta: generateMeta(page, limit, totalRecords),
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

module.exports = { getRecentActivities };
