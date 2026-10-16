const Baby = require("@models/Baby");
const Nutrition = require("@models/Nutrition");
const Recipe = require("@models/Recipe");
const { User } = require("@models/UserModel");
const {
  sendResponse,
  validateParams,
  parsePaginationParams,
  generateMeta,
} = require("@utils/responseUtil");
const { logActivity } = require("@utils/activityUtil");

// ─── PUBLIC ───────────────────────────────────────────────────────────────────

const getNutritionByRecipe = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        pathParams: ["recipeId"],
        objectIdFields: ["recipeId"],
      })
    )
      return;

    const nutrition = await Nutrition.findOne({
      recipe: req.params.recipeId,
      isActive: true,
    }).populate("recipe", "_id title");

    if (!nutrition) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "nutrition_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: {
        nutrients: nutrition.nutrients,

        feedingInsight: nutrition.feedingInsight,

        allergyReminder: nutrition.allergyReminder,
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

const getNutrition = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    const baby = await Baby.findById(user.activeBaby);

    if (!baby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    const recipes = await Recipe.find({
      babyStage: baby.babyStage,

      status: "published",

      isActive: true,
    }).select("_id");

    const recipeIds = recipes.map((r) => r._id);

    const nutritions = await Nutrition.find({
      recipe: {
        $in: recipeIds,
      },

      isActive: true,
    });

    const nutrientMap = new Map();

    nutritions.forEach((nutrition) => {
      nutrition.nutrients.forEach((nutrient) => {
        if (!nutrientMap.has(nutrient.name)) {
          nutrientMap.set(
            nutrient.name,

            {
              name: nutrient.name,

              benefit: nutrient.benefit,
            },
          );
        }
      });
    });

    const nutrients = Array.from(nutrientMap.values());

    return sendResponse({
      res,

      statusCode: 200,

      translationKey: "data_fetched_successfully",

      data: nutrients,
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

// ─── ADMIN ────────────────────────────────────────────────────────────────────

const adminGetNutritions = async (req, res) => {
  const { page, limit } = parsePaginationParams(req);

  try {
    const { search = "", status } = req.query;

    const query = {};

    if (status) query.status = status;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { benefit: { $regex: search, $options: "i" } },
      ];
    }

    const [nutrients, totalRecords] = await Promise.all([
      Nutrition.aggregate([
        {
          $match: query,
        },

        {
          $lookup: {
            from: "recipes",
            let: {
              nutritionId: "$_id",
            },

            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: ["$$nutritionId", "$nutritionTags"],
                  },
                },
              },

              {
                $count: "count",
              },
            ],

            as: "recipeStats",
          },
        },

        {
          $addFields: {
            recipes: {
              $ifNull: [
                {
                  $arrayElemAt: ["$recipeStats.count", 0],
                },
                0,
              ],
            },
          },
        },

        {
          $project: {
            name: 1,
            benefit: 1,
            status: 1,
            isActive: 1,
            recipes: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },

        {
          $sort: {
            name: 1,
          },
        },

        {
          $skip: (page - 1) * limit,
        },

        {
          $limit: limit,
        },
      ]),

      Nutrition.countDocuments(query),
    ]);

    const meta = generateMeta(page, limit, totalRecords);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: nutrients,
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

// Create nutrient
const createNutrition = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        rawData: ["name", "benefit"],
      })
    )
      return;

    const { name, benefit, status, isActive } = req.body;

    const nutrition = await Nutrition.create({
      name: name.trim(),
      benefit: benefit.trim(),
      status: status || "active",
      isActive: isActive !== undefined ? isActive : true,
    });

    void logActivity({
      user: req.user._id,
      userType: req.user.userType ?? req.user.accountState?.userType,
      action: "Nutrition Created",
      detail: `Created Nutrition ${nutrition.name}`,
      module: "nutrition",
      targetId: nutrition._id,
      metadata: {
        benefit: nutrition.benefit,
        status: nutrition.status,
        isActive: nutrition.isActive,
      },
    });

    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "nutrition_created_success",
      data: nutrition,
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

// Update nutrient
const updateNutrition = async (req, res) => {
  try {
    if (
      !validateParams(req, res, { pathParams: ["id"], objectIdFields: ["id"] })
    )
      return;

    const nutrition = await Nutrition.findById(req.params.id);
    if (!nutrition) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "nutrition_not_found",
      });
    }

    const fields = ["name", "benefit", "status", "isActive"];

    if (req.body.status) {
      const allowedStatuses = ["active", "disabled"];

      if (!allowedStatuses.includes(req.body.status)) {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey: "invalid_status",
        });
      }
    }

    fields.forEach((field) => {
      if (req.body[field] !== undefined) nutrition[field] = req.body[field];
    });

    await nutrition.save();

    void logActivity({
      user: req.user._id,
      userType: req.user.userType ?? req.user.accountState?.userType,
      action: "Nutrition Updated",
      detail: `Updated Nutrition ${nutrition.name}`,
      module: "nutrition",
      targetId: nutrition._id,
      metadata: {
        benefit: nutrition.benefit,
        status: nutrition.status,
        isActive: nutrition.isActive,
      },
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "nutrition_updated_success",
      data: nutrition,
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

// Delete nutrient (blocked if any Recipe still references it)
const deleteNutrition = async (req, res) => {
  try {
    if (
      !validateParams(req, res, { pathParams: ["id"], objectIdFields: ["id"] })
    )
      return;

    const nutrition = await Nutrition.findById(req.params.id);
    if (!nutrition) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "nutrition_not_found",
      });
    }

    const isInUse = await Recipe.exists({
      nutritionTags: nutrition._id,
    });

    if (isInUse) {
      return sendResponse({
        res,
        statusCode: 409,
        translationKey: "nutrition_in_use",
      });
    }

    await Nutrition.findByIdAndDelete(req.params.id);

    void logActivity({
      user: req.user._id,
      userType: req.user.userType ?? req.user.accountState?.userType,
      action: "Nutrition Deleted",
      detail: `Deleted Nutrition ${nutrition.name}`,
      module: "nutrition",
      targetId: nutrition._id,
      metadata: {
        benefit: nutrition.benefit,
        status: nutrition.status,
      },
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "nutrition_deleted_success",
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
  getNutritionByRecipe,
  getNutrition,
  adminGetNutritions,
  createNutrition,
  updateNutrition,
  deleteNutrition,
};
