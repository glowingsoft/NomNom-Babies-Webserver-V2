const Country = require("@models/Country");
const Recipe = require("@models/Recipe");
const { User } = require("@models/UserModel");
const {
  sendResponse,
  validateParams,
  parsePaginationParams,
  generateMeta,
} = require("@utils/responseUtil");
const { logActivity } = require("@utils/activityUtil");

const getCountries = async (req, res) => {
  const { page, limit } = parsePaginationParams(req);

  try {
    const [countries, totalCountries] = await Promise.all([
      Country.find({ isEnabled: true })
        .sort({ name: 1 })
        .select("name signatureFoods")
        .skip((page - 1) * limit)
        .limit(limit),
      Country.countDocuments({ isEnabled: true }),
    ]);

    const meta = generateMeta(page, limit, totalCountries);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: countries,
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

const getCountryById = async (req, res) => {
  try {
    const country = await Country.findById(req.params.id);

    if (!country) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "country_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: country,
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

// Select up to 2 countries (logged-in user)
const selectCountries = async (req, res) => {
  try {
    if (!validateParams(req, res, { rawData: ["countryIds"] })) return;

    const { countryIds } = req.body;

    // Must be an array
    if (!Array.isArray(countryIds)) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "country_ids_must_be_array",
      });
    }

    // Max 2 countries
    if (countryIds.length > 2) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "max_two_countries_allowed",
      });
    }

    // Validate all IDs are valid ObjectIds
    const mongoose = require("mongoose");
    const allValid = countryIds.every((id) =>
      mongoose.Types.ObjectId.isValid(id),
    );
    if (!allValid) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "invalid_country_id",
      });
    }

    // Ensure all countries exist and are enabled
    const countries = await Country.find({
      _id: { $in: countryIds },
      isEnabled: true,
    }).select("name signatureFoods");

    if (countries.length !== countryIds.length) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "country_not_found",
      });
    }

    // Save to user
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        "onboarding.selectedCountries": countryIds,
        "onboarding.completed": true,
      },
      { new: true },
    ).populate("onboarding.selectedCountries", "_id name signatureFoods");

    void logActivity({
      user: req.user._id,
      userType: req.user.userType || req.user.accountState?.userType,
      action: "Countries Selected",
      detail: `Selected ${countries.length} Country`,
      module: "country",
      targetId: req.user._id,
      metadata: {
        countries: countries.map((country) => ({
          id: country._id,
          name: country.name,
          code: country.code,
        })),
      },
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "countries_selected_success",
      data: { onboarding: user.onboarding },
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

const createCountry = async (req, res) => {
  try {
    if (!validateParams(req, res, { rawData: ["name", "code"] })) return;

    const {
      name,
      code,
      status = "active",
      isEnabled = true,
      signatureFoods = [],
    } = req.body;

    const existing = await Country.findOne({
      $or: [{ name: name.trim() }, { code: code.trim().toUpperCase() }],
    });
    if (existing) {
      return sendResponse({
        res,
        statusCode: 409,
        translationKey: "country_already_exists",
      });
    }

    const country = await Country.create({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      status,
      isEnabled,
      signatureFoods,
    });

    void logActivity({
      user: req.user._id,
      userType: req.user.userType ?? req.user.accountState?.userType,
      action: "Country Created",
      detail: `Created Country ${country.name}`,
      module: "country",
      targetId: country._id,
      metadata: {
        code: country.code,
        status: country.status,
        enabled: country.isEnabled,
      },
    });

    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "country_created",
      data: country,
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

const updateCountry = async (req, res) => {
  try {
    const { name, code, status, signatureFoods, isEnabled } = req.body;

    if (name || code) {
      const clash = await Country.findOne({
        _id: { $ne: req.params.id },
        $or: [
          ...(name ? [{ name: name.trim() }] : []),
          ...(code ? [{ code: code.trim().toUpperCase() }] : []),
        ],
      });
      if (clash) {
        return sendResponse({
          res,
          statusCode: 409,
          translationKey: "country_already_exists",
        });
      }
    }

    const country = await Country.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          ...(name !== undefined && { name: name.trim() }),
          ...(code !== undefined && { code: code.trim().toUpperCase() }),
          ...(status !== undefined && { status }),
          ...(signatureFoods !== undefined && { signatureFoods }),
          ...(isEnabled !== undefined && { isEnabled }),
        },
      },
      { new: true, runValidators: true },
    );

    if (!country) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "country_not_found",
      });
    }

    void logActivity({
      user: req.user._id,
      userType: req.user.userType ?? req.user.accountState?.userType,
      action: "Country Updated",
      detail: `Updated Country ${country.name}`,
      module: "country",
      targetId: country._id,
      metadata: {
        code: country.code,
        status: country.status,
        enabled: country.isEnabled,
      },
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "country_updated",
      data: country,
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

const deleteCountry = async (req, res) => {
  try {
    const recipeCount = await Recipe.countDocuments({
      country: req.params.id,
    });

    if (recipeCount > 0) {
      return sendResponse({
        res,
        statusCode: 409,
        translationKey: "country_has_recipes",
      });
    }

    const country = await Country.findByIdAndDelete(req.params.id);

    if (!country) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "country_not_found",
      });
    }

    void logActivity({
      user: req.user._id,
      userType: req.user.userType ?? req.user.accountState?.userType,
      action: "Country Deleted",
      detail: `Deleted Country ${country.name}`,
      module: "country",
      targetId: country._id,
      metadata: {
        code: country.code,
      },
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "country_deleted",
      data: { id: req.params.id },
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

const adminGetCountries = async (req, res) => {
  const { page, limit } = parsePaginationParams(req);

  try {
    const { search = "", status, enabled } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      query.status = status;
    }

    if (enabled !== undefined) {
      query.isEnabled = enabled === "true";
    }

    const [countries, totalCountries] = await Promise.all([
      Country.aggregate([
        {
          $match: query,
        },

        {
          $lookup: {
            from: "recipes",
            let: {
              countryId: "$_id",
            },

            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$country", "$$countryId"],
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

            enabled: "$isEnabled",
          },
        },

        {
          $project: {
            name: 1,
            code: 1,
            status: 1,
            isEnabled: 1,
            enabled: 1,
            signatureFoods: 1,
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

      Country.countDocuments(query),
    ]);

    const meta = generateMeta(page, limit, totalCountries);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: countries,
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
  getCountries,
  getCountryById,
  selectCountries,
  createCountry,
  updateCountry,
  deleteCountry,
  adminGetCountries,
};
