const FoodTracker = require("@models/FoodTracker");
const { User } = require("@models/UserModel");
const Baby = require("@models/Baby");
const { lookupOne } = require("@utils/aggregationUtil");
const {
  generateMeta,
  parsePaginationParams,
  sendResponse,
  validateParams,
} = require("@utils/responseUtil");
const { logActivity } = require("@utils/activityUtil");

const createFoodTracker = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        rawData: ["ingredientName", "date", "reaction"],
      })
    ) {
      return;
    }

    const { ingredientName, date, reaction } = req.body;

    const user = await User.findById(req.user._id);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    const foodTracker = await FoodTracker.create({
      baby: user.activeBaby,
      user: req.user._id,
      ingredientName,
      date,
      reaction,
    });

    void logActivity({
      user: req.user._id,
      userType: req.user.role || "user",
      action: "create",
      detail: `Added food tracker entry for ${ingredientName}`,
      module: "food_tracker",
      baby: user.activeBaby,
      targetId: foodTracker._id,
      metadata: {
        ingredientName,
        date,
        reaction,
      },
    });

    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "food_tracker_created_successfully",
      data: foodTracker,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      trasnlationKey: error.message,
      error,
    });
  }
};

const getFoodTracker = async (req, res) => {
  try {
    const { page, limit } = parsePaginationParams(req);

    const user = await User.findById(req.user._id);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    const query = {
      baby: user.activeBaby,
      user: req.user._id,
    };

    const [foodTracker, totalRecords] = await Promise.all([
      FoodTracker.find(query)
        .sort({ date: -1 })
        .skip((page - 1) * limit)
        .limit(limit),

      FoodTracker.countDocuments(query),
    ]);

    const meta = generateMeta(page, limit, totalRecords);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "food_tracker_fetched_successfully",

      data: foodTracker,

      meta,
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

const getAllFoodTrackers = async (req, res) => {
  try {
    const { page, limit } = parsePaginationParams(req);

    const [foodTrackers, totalRecords] = await Promise.all([
      FoodTracker.aggregate([
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        ...lookupOne({
          from: Baby.collection.name,
          field: "baby",
          fields: ["_id", "name"],
        }),
        ...lookupOne({
          from: User.collection.name,
          field: "user",
          fields: ["_id", { name: "name", default: "" }, "email"],
        }),
        { $addFields: { image: { $ifNull: ["$image", ""] } } },
      ]),

      FoodTracker.countDocuments(),
    ]);

    const meta = generateMeta(page, limit, totalRecords);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "food_trackers_fetched_successfully",
      data: foodTrackers,
      meta,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: error.message,
      error,
    });
  }
};

module.exports = {
  createFoodTracker,
  getFoodTracker,

  getAllFoodTrackers,
};
