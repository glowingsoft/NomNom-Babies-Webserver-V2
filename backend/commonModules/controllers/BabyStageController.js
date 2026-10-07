const BabyStage = require("@models/BabyStage");
const Baby = require("@models/Baby");
const { User } = require("@models/UserModel");
const {
  sendResponse,
  parsePaginationParams,
  generateMeta,
  validateParams,
} = require("@utils/responseUtil");
const Recipe = require("@models/Recipe");
const { logActivity } = require("@utils/activityUtil");

// ─── PUBLIC ───────────────────────────────────────────────────────────────────

// Get all active baby stages (for the selection screen)
const getBabyStages = async (req, res) => {
  const { page, limit } = parsePaginationParams(req);

  try {
    const [stages, totalStages] = await Promise.all([
      BabyStage.find({ active: true })
        .sort({ createdAt: 1 })
        .select("title features")
        .skip((page - 1) * limit)
        .limit(limit),

      BabyStage.countDocuments({ active: true }),
    ]);

    const meta = generateMeta(page, limit, totalStages);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: stages,
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

// Get a single baby stage by ID
const getBabyStageById = async (req, res) => {
  try {
    const validationOptions = {
      pathParams: ["id"],
      objectIdFields: ["id"],
    };

    if (!validateParams(req, res, validationOptions)) return;

    const stage = await BabyStage.findOne({ _id: req.params.id, active: true });

    if (!stage) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_stage_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: stage,
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

// Select a baby stage (logged-in user)
const selectBabyStage = async (req, res) => {
  try {
    const validationOptions = {
      rawData: ["stageId", "babyName"],
      objectIdFields: ["stageId"],
    };

    if (!validateParams(req, res, validationOptions)) return;

    const { stageId, babyName } = req.body;

    const stage = await BabyStage.findOne({ _id: stageId, active: true });
    if (!stage) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_stage_not_found",
      });
    }

    const baby = await Baby.create({
      user: req.user._id,
      name: babyName.trim(),
      babyStage: stage._id,
    });

    const user = await User.findById(req.user._id);

    if (!user.activeBaby) {
      user.activeBaby = baby._id;
    }

    user.onboarding.completed = true;

    await user.save();

    await baby.populate("babyStage", "title features");

    void logActivity({
      user: req.user._id,
      userType: req.user.userType ?? req.user.accountState?.userType,
      action: "Baby Stage Selected",
      detail: `Selected BabyStage ${stage.title} for baby ${baby.name}`,
      module: "baby_stage",
      baby: baby._id,
      targetId: stage._id,
      metadata: {
        babyName: baby.name,
        stageTitle: stage.title,
      },
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "baby_stage_selected_success",
      data: baby,
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

// Get all baby stages with pagination (admin)
const adminGetBabyStages = async (req, res) => {
  const { page, limit } = parsePaginationParams(req);

  const { search, status = "all" } = req.query;

  const filters = {};

  if (status === "active") {
    filters.active = true;
  }
  if (status === "disabled") {
    filters.active = false;
  }
  if (search) {
    filters.$or = [
      {
        title: {
          $regex: search,
          $options: "i",
        },
      },
      {
        features: {
          $elemMatch: {
            $regex: search,
            $options: "i",
          },
        },
      },
    ];
  }

  try {
    const [stages, totalStages] = await Promise.all([
      BabyStage.find(filters)
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      BabyStage.countDocuments(filters),
    ]);

    const stageIds = stages.map((s) => s._id);

    const recipeCounts = await Recipe.aggregate([
      {
        $match: {
          babyStage: {
            $in: stageIds,
          },
        },
      },
      {
        $group: {
          _id: "$babyStage",

          count: {
            $sum: 1,
          },
        },
      },
    ]);

    const recipeMap = {};

    recipeCounts.forEach((item) => {
      recipeMap[item._id.toString()] = item.count;
    });

    const data = stages.map((stage) => ({
      ...stage.toObject(),

      recipes: recipeMap[stage._id.toString()] || 0,
    }));

    const meta = generateMeta(page, limit, totalStages);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data,
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

// Create a new baby stage
const createBabyStage = async (req, res) => {
  const { title, features = [] } = req.body;

  try {
    const validationOptions = {
      rawData: ["title"],
    };

    if (!validateParams(req, res, validationOptions)) return;

    const exists = await BabyStage.findOne({
      title: title.trim(),
    });

    if (exists) {
      return sendResponse({
        res,

        statusCode: 409,

        translationKey: "baby_stage_already_exists",
      });
    }

    const stage = new BabyStage({ title: title.trim(), features });
    await stage.save();

    void logActivity({
      user: req.user._id,
      userType: req.user.userType ?? req.user.accountState?.userType,
      action: "Baby Stage Created",
      detail: `Created BabyStage ${stage.title}`,
      module: "baby_stage",
      targetId: stage._id,
      metadata: {
        active: stage.active,
        featuresCount: stage.features.length,
      },
    });

    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "baby_stage_created_success",
      data: stage,
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

// Update an existing baby stage
const updateBabyStage = async (req, res) => {
  const { title, features, active } = req.body;

  try {
    const validationOptions = {
      pathParams: ["id"],
      objectIdFields: ["id"],
    };

    if (!validateParams(req, res, validationOptions)) return;

    const stage = await BabyStage.findById(req.params.id);
    if (!stage) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_stage_not_found",
      });
    }

    if (title !== undefined) {
      stage.title = title.trim();
    }

    if (features !== undefined) {
      stage.features = features;
    }

    if (active !== undefined) {
      stage.active = active;
    }

    await stage.save();

    void logActivity({
      user: req.user._id,
      userType: req.user.userType ?? req.user.accountState?.userType,
      action: "Baby Stage Updated",
      detail: `Updated BabyStage ${stage.title}`,
      module: "baby_stage",
      targetId: stage._id,
      metadata: {
        active: stage.active,
        featuresCount: stage.features.length,
      },
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "baby_stage_updated_success",
      data: stage,
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

// Delete a baby stage
const deleteBabyStage = async (req, res) => {
  try {
    const validationOptions = {
      pathParams: ["id"],
      objectIdFields: ["id"],
    };

    if (!validateParams(req, res, validationOptions)) return;

    const recipeCount = await Recipe.countDocuments({
      babyStage: req.params.id,
    });

    if (recipeCount > 0) {
      return sendResponse({
        res,
        statusCode: 409,
        translationKey: "babyStage_has_recipes",
      });
    }

    const stage = await BabyStage.findByIdAndDelete(req.params.id);
    if (!stage) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_stage_not_found",
      });
    }

    void logActivity({
      user: req.user._id,
      userType: req.user.userType ?? req.user.accountState?.userType,
      action: "Baby Stage Deleted",
      detail: `Deleted BabyStage ${stage.title}`,
      module: "baby_stage",
      targetId: stage._id,
      metadata: {
        active: stage.active,
        featuresCount: stage.features.length,
      },
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "baby_stage_deleted_success",
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
  getBabyStages,
  getBabyStageById,
  selectBabyStage,
  adminGetBabyStages,
  createBabyStage,
  updateBabyStage,
  deleteBabyStage,
};
