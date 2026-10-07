const Baby = require("@models/Baby");
const BabyStage = require("@models/BabyStage");
const Country = require("@models/Country");
const { User } = require("@models/UserModel");
const {
  sendResponse,
  validateParams,
  parsePaginationParams,
  generateMeta,
} = require("@utils/responseUtil");
const { getBabyInfo, babyPopulate } = require("@utils/babyUtil");
const { logActivity } = require("@utils/activityUtil");
const { sendUserNotifications } = require("./communicationController");
const { NotificationTypes } = require("@models/Notifications");

// Create a new baby profile
const createBaby = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        rawData: ["name", "stageId", "selectedCountries"],
      })
    )
      return;

    const { profileIcon, name, stageId, selectedCountries = [] } = req.body;
    // Validate stage if provided
    if (stageId) {
      const stage = await BabyStage.findOne({ _id: stageId, active: true });
      if (!stage) {
        return sendResponse({
          res,
          statusCode: 404,
          translationKey: "baby_stage_not_found",
        });
      }
    }

    // Get user and onboarding countries
    const user = await User.findById(req.user._id);

    const finalCountries =
      selectedCountries.length > 0
        ? selectedCountries
        : user.onboarding?.selectedCountries || [];

    // Validate countries
    if (finalCountries.length > 2) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "max_two_countries_allowed",
      });
    }

    if (finalCountries.length > 0) {
      const countries = await Country.find({
        _id: { $in: finalCountries },
        isEnabled: true,
      });

      if (countries.length !== finalCountries.length) {
        return sendResponse({
          res,
          statusCode: 404,
          translationKey: "country_not_found",
        });
      }
    }

    const baby = new Baby({
      user: req.user._id,
      profileIcon,
      name: name.trim(),
      babyStage: stageId || null,
      selectedCountries: finalCountries,
    });

    await baby.validate();
    await baby.save();

    user.activeBaby = baby._id;
    await user.save();

    await baby.populate([
      { path: "babyStage", select: "_id title features" },
      { path: "selectedCountries", select: "_id name signatureFoods" },
    ]);

    void logActivity({
      user: req.user._id,
      userType: req.user.userType ?? req.user.accountState?.userType,
      action: "Baby Created",
      detail: `Created Baby Profile ${baby.name}`,
      module: "baby",
      baby: baby._id,
      targetId: baby._id,
      metadata: {
        profileIcon: baby.profileIcon,
        stage: baby.babyStage?._id,
        selectedCountries: baby.selectedCountries.map((country) => country._id),
      },
    });

    //send notificaiton for new created baby
    void sendUserNotifications({
      recipientIds: [req.user._id],
      title: "New Baby added",
      body: `Created Baby Profile ${baby.name}`,
      data: { type: NotificationTypes.NEW_BABY, objectType: "Baby" },
      sender: null, // Optional: sender ID
      objectId: baby._id, // Optional: object ID
      saveNotification: true, // send false if you don't want to save notification in db
    });

    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "baby_created_success",
      data: getBabyInfo(baby),
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

// Get all babies for logged-in user
const getBabies = async (req, res) => {
  try {
    const { page, limit } = parsePaginationParams(req);
    const query = {
      user: req.user._id,
      isActive: true,
    };
    const [babies, totalRecords] = await Promise.all([
      Baby.find(query)
        .populate(babyPopulate)
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit),

      Baby.countDocuments(query),
    ]);

    const meta = generateMeta(page, limit, totalRecords);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: babies,
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

const getUserBabies = async (req, res) => {
  try {
    const { id } = req.params;

    const { page, limit } = parsePaginationParams(req);

    const user = await User.findById(id);

    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "user_not_found",
      });
    }

    const query = {
      user: id,
      isActive: true,
    };

    const [babies, totalRecords] = await Promise.all([
      Baby.find(query)
        .populate(babyPopulate)
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit),

      Baby.countDocuments(query),
    ]);

    const meta = generateMeta(page, limit, totalRecords);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: babies,
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

// Get a single baby by ID
const getBabyById = async (req, res) => {
  try {
    if (
      !validateParams(req, res, { pathParams: ["id"], objectIdFields: ["id"] })
    )
      return;

    const baby = await Baby.findOne({
      _id: req.params.id,
      user: req.user._id,
      isActive: true,
    }).populate(babyPopulate);

    if (!baby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
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

// Update a baby profile (name, stage, countries)
const updateBaby = async (req, res) => {
  try {
    if (
      !validateParams(req, res, { pathParams: ["id"], objectIdFields: ["id"] })
    )
      return;

    const { profileIcon, name, stageId, countryIds } = req.body;

    const baby = await Baby.findOne({
      _id: req.params.id,
      user: req.user._id,
      isActive: true,
    });
    if (!baby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    if (profileIcon !== undefined) {
      baby.profileIcon = profileIcon;
    }

    if (name) baby.name = name.trim();

    if (stageId !== undefined) {
      if (stageId) {
        const stage = await BabyStage.findOne({ _id: stageId, active: true });
        if (!stage) {
          return sendResponse({
            res,
            statusCode: 404,
            translationKey: "baby_stage_not_found",
          });
        }
      }
      baby.babyStage = stageId || null;
    }

    if (countryIds !== undefined) {
      if (countryIds.length > 2) {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey: "max_two_countries_allowed",
        });
      }
      if (countryIds.length > 0) {
        const countries = await Country.find({
          _id: { $in: countryIds },
          isEnabled: true,
        });
        if (countries.length !== countryIds.length) {
          return sendResponse({
            res,
            statusCode: 404,
            translationKey: "country_not_found",
          });
        }
      }
      baby.selectedCountries = countryIds;
    }

    await baby.save();
    await baby.populate(babyPopulate);

    void logActivity({
      user: req.user._id,
      userType: req.user.userType ?? req.user.accountState?.userType,
      action: "Baby Updated",
      detail: `Updated Baby Profile ${baby.name}`,
      module: "baby",
      baby: baby._id,
      targetId: baby._id,
      metadata: {
        profileIcon: baby.profileIcon,
        stage: baby.babyStage?._id,
        selectedCountries: baby.selectedCountries.map(
          (country) => country._id || country,
        ),
      },
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "baby_updated_success",
      data: getBabyInfo(baby),
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

// Delete a baby profile (soft delete)
const deleteBaby = async (req, res) => {
  try {
    if (
      !validateParams(req, res, { pathParams: ["id"], objectIdFields: ["id"] })
    )
      return;

    const baby = await Baby.findOne({ _id: req.params.id, user: req.user._id });
    if (!baby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    baby.isActive = false;
    await baby.save();

    void logActivity({
      user: req.user._id,
      userType: req.user.userType ?? req.user.accountState?.userType,
      action: "Baby Deleted",
      detail: `Deleted Baby Profile ${baby.name}`,
      module: "baby",
      baby: baby._id,
      targetId: baby._id,
      metadata: {
        isActive: baby.isActive,
      },
    });

    // If deleted baby was the active one, switch to another
    const user = await User.findById(req.user._id);
    if (String(user.activeBaby) === String(baby._id)) {
      const nextBaby = await Baby.findOne({
        user: req.user._id,
        isActive: true,
      });
      user.activeBaby = nextBaby ? nextBaby._id : null;
      await user.save();
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "baby_deleted_success",
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

// Switch active baby
const switchActiveBaby = async (req, res) => {
  try {
    const userId = req.user._id;
    if (
      !validateParams(req, res, {
        rawData: ["babyId"],
        objectIdFields: ["babyId"],
      })
    )
      return;

    const { babyId } = req.body;

    const baby = await Baby.findOne({
      _id: babyId,
      user: req.user._id,
      isActive: true,
    });
    if (!baby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    await User.findByIdAndUpdate(req.user._id, { activeBaby: baby._id });

    await baby.populate(babyPopulate);

    void logActivity({
      user: req.user._id,
      userType: req.user.userType ?? req.user.accountState?.userType,
      action: "Active Baby Switched",
      detail: `Switched Active Baby to ${baby.name}`,
      module: "baby",
      baby: baby._id,
      targetId: baby._id,
      metadata: {
        stage: baby.babyStage?._id,
      },
    });
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "active_baby_switched_success",
      data: {
        babyInfo: getBabyInfo(baby),
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
  createBaby,
  getBabies,
  getUserBabies,
  getBabyById,
  updateBaby,
  deleteBaby,
  switchActiveBaby,
};
