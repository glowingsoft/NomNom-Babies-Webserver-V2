const Meals = require("@models/Meals");
const Recipe = require("@models/Recipe");

const {
  sendResponse,
  validateParams,
  parsePaginationParams,
  generateMeta,
} = require("@utils/responseUtil");

const { logActivity } = require("@utils/activityUtil");

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────────────────────────────────


const adminGetMeals = async (req, res) => {
  const { page, limit } = parsePaginationParams(req);

  try {
    const {
      search = "",
      status,
      isActive,
    } = req.query;

    const matchQuery = {};

    // Search by meal name
    if (search) {
      matchQuery.name = {
        $regex: search,
        $options: "i",
      };
    }

    // Filter by status
    if (status) {
      matchQuery.status = status;
    }

    // Filter by active state
    if (isActive !== undefined) {
      matchQuery.isActive =
        isActive === "true" || isActive === true;
    }

    const skip = (page - 1) * limit;

    const [meals, totalRecords] = await Promise.all([
      Meals.aggregate([
        {
          $match: matchQuery,
        },

        // Match recipes whose mealType references this meal
        {
          $lookup: {
            from: Recipe.collection.name,
            let: {
              mealId: "$_id",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$$mealId", "$mealType"],
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

        // Convert lookup result into recipesCount
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

        // Don't return internal lookup data
        {
          $project: {
            name: 1,
            description: 1,
            status: 1,
            isActive: 1,
            recipes: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },

        {
          $sort: {
            name: -1,
          },
        },

        {
          $skip: skip,
        },

        {
          $limit: limit,
        },
      ]),

      Meals.countDocuments(matchQuery),
    ]);

    const meta = generateMeta(
      page,
      limit,
      totalRecords,
    );

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: meals,
      meta,
    });
  } catch (error) {
    console.error("adminGetMeals error:", error);

    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

const createMeal = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        rawData: [
          "name",
          "description",
        ],
      })
    ) {
      return;
    }

    const {
      name,
      description,
      status,
      isActive,
    } = req.body;

    // Validate status
    const allowedStatuses = ["active", "disabled"];

    if (status && !allowedStatuses.includes(status)) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "invalid_status",
        error: "Status must be either active or disabled",
      });
    }

    // Validate isActive
    if (
      isActive !== undefined &&
      typeof isActive !== "boolean"
    ) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "invalid_is_active",
        error: "isActive must be a boolean",
      });
    }

    // Check duplicate name
    const existingMeal = await Meals.findOne({
      name: {
        $regex: `^${name.trim()}$`,
        $options: "i",
      },
    });

    if (existingMeal) {
      return sendResponse({
        res,
        statusCode: 409,
        translationKey: "meal_already_exists",
        error: "A meal type with this name already exists",
      });
    }

    const meal = await Meals.create({
      name: name.trim(),
      description: description.trim(),
      status: status || "active",
      isActive:
        isActive !== undefined ? isActive : true,
    });

    void logActivity({
      user: req.user._id,
      userType:
        req.user.userType ??
        req.user.accountState?.userType,

      action: "Meal Type Created",

      detail: `Created Meal Type ${meal.name}`,

      module: "meal",

      targetId: meal._id,

      metadata: {
        name: meal.name,
        status: meal.status,
        isActive: meal.isActive,
      },
    });

    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "meal_created_success",
      data: {
        ...meal.toObject(),
        recipesCount: 0,
      },
    });
  } catch (error) {
    console.error("createMeal error:", error);

    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────

const updateMeal = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        pathParams: ["id"],
        objectIdFields: ["id"],
      })
    ) {
      return;
    }

    const meal = await Meals.findById(req.params.id);

    if (!meal) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "meal_not_found",
      });
    }

    const {
      name,
      description,
      status,
      isActive,
    } = req.body;

    // ─────────────────────────────────────────────
    // Validate status
    // ─────────────────────────────────────────────

    if (status !== undefined) {
      const allowedStatuses = [
        "active",
        "disabled",
      ];

      if (!allowedStatuses.includes(status)) {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey: "invalid_status",
          error:
            "Status must be either active or disabled",
        });
      }
    }

    // ─────────────────────────────────────────────
    // Validate isActive
    // ─────────────────────────────────────────────

    if (
      isActive !== undefined &&
      typeof isActive !== "boolean"
    ) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "invalid_is_active",
        error: "isActive must be a boolean",
      });
    }

    // ─────────────────────────────────────────────
    // Check duplicate name
    // ─────────────────────────────────────────────

    if (name !== undefined) {
      const existingMeal = await Meals.findOne({
        _id: {
          $ne: meal._id,
        },
        name: {
          $regex: `^${name.trim()}$`,
          $options: "i",
        },
      });

      if (existingMeal) {
        return sendResponse({
          res,
          statusCode: 409,
          translationKey: "meal_already_exists",
          error:
            "A meal type with this name already exists",
        });
      }

      meal.name = name.trim();
    }

    // ─────────────────────────────────────────────
    // Update fields
    // ─────────────────────────────────────────────

    if (description !== undefined) {
      meal.description = description.trim();
    }

    if (status !== undefined) {
      meal.status = status;
    }

    if (isActive !== undefined) {
      meal.isActive = isActive;
    }

    await meal.save();

    // ─────────────────────────────────────────────
    // Get recipes count
    // ─────────────────────────────────────────────

    const recipesCount = await Recipe.countDocuments({
      mealType: meal._id,
    });

    void logActivity({
      user: req.user._id,
      userType:
        req.user.userType ??
        req.user.accountState?.userType,

      action: "Meal Type Updated",

      detail: `Updated Meal Type ${meal.name}`,

      module: "meal",

      targetId: meal._id,

      metadata: {
        name: meal.name,
        status: meal.status,
        isActive: meal.isActive,
        recipesCount,
      },
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "meal_updated_success",
      data: {
        ...meal.toObject(),
        recipesCount,
      },
    });
  } catch (error) {
    console.error("updateMeal error:", error);

    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────
const deleteMeal = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        pathParams: ["id"],
        objectIdFields: ["id"],
      })
    ) {
      return;
    }

    const meal = await Meals.findById(req.params.id);

    if (!meal) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "meal_not_found",
      });
    }

    // Check whether recipes are using this meal type
    const recipesCount = await Recipe.countDocuments({
      mealType: meal._id,
    });

    if (recipesCount > 0) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "meal_in_use",
        data: {
          recipesCount,
        },
        error: `This meal type is currently used by ${recipesCount} recipe(s) and cannot be deleted`,
      });
    }

    await Meals.findByIdAndDelete(meal._id);

    void logActivity({
      user: req.user._id,
      userType:
        req.user.userType ??
        req.user.accountState?.userType,

      action: "Meal Type Deleted",

      detail: `Deleted Meal Type ${meal.name}`,

      module: "meal",

      targetId: meal._id,

      metadata: {
        name: meal.name,
        status: meal.status,
        isActive: meal.isActive,
        recipesCount: 0,
      },
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "meal_deleted_success",
    });
  } catch (error) {
    console.error("deleteMeal error:", error);

    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  adminGetMeals,
  createMeal,
  updateMeal,
  deleteMeal,
};
