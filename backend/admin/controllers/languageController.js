const Language = require("@models/Language");
const { User } = require("@models/UserModel");
const {
  sendResponse,
  parsePaginationParams,
  generateMeta,
  validateParams,
} = require("@utils/responseUtil");
const { userCache } = require("@config/nodeCache");
const { logActivity } = require("@utils/activityUtil");

// Create a new language
const createLanguage = async (req, res) => {
  const { title, transliteration, flag, code, active } = req.body;

  try {
    //validate params
    const validationOptions = {
      rawData: ["title", "transliteration", "code"],
    };

    if (!validateParams(req, res, validationOptions)) {
      return;
    }

    const language = new Language({
      title,
      transliteration,
      flag,
      code,
      active,
    });

    const exists = await Language.findOne({
      code: code.toLowerCase(),
    });

    if (exists) {
      return sendResponse({
        res,
        statusCode: 409,
        translationKey: "language_code_unique_violation",
      });
    }
    await language.save();

    void logActivity({
      user: req.user._id,
      userType: req.user.userType || req.user.accountState?.userType,
      action: "Language Created",
      detail: `Created Language ${language.title}`,
      module: "language",
      targetId: language._id,
      metadata: {
        code: language.code,
      },
    });

    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "language_created_success", // Translation key for success
      data: language,
    });
  } catch (error) {
    if (error.code === 11000) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "language_code_unique_violation", // Custom translation key for duplicate language code
        error,
      });
    }
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};

// Get all languages with pagination
const getLanguages = async (req, res) => {
  const { page, limit } = parsePaginationParams(req);

  const { search, status = "all" } = req.query;

  const filters = {};

  if (status === "active") {
    filters.active = true;
  }

  if (status === "inactive") {
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
        transliteration: {
          $regex: search,
          $options: "i",
        },
      },
      {
        code: {
          $regex: search,
          $options: "i",
        },
      },
    ];
  }

  try {
    const [languages, totalLanguages] = await Promise.all([
      Language.find(filters)
        .sort({ title: 1 }) // Sort by title in alphabetical order
        .skip((page - 1) * limit)
        .limit(limit),
      Language.countDocuments(filters),
    ]);

    const formatted = languages.map((item) => ({
      _id: item._id,
      title: item.title,
      transliteration: item.transliteration,
      flag: item.flag,
      code: item.code,
      active: item.active,
    }));

    const meta = generateMeta(page, limit, totalLanguages);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "languages_fetched_success", // Translation key for success
      data: formatted,
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

// Update an existing language
const updateLanguage = async (req, res) => {
  const { id } = req.params;
  const { title, transliteration, flag, code, active } = req.body;
  try {
    const validationOptions = {
      pathParams: ["id"],
      objectIdFields: ["id"],
    };

    if (!validateParams(req, res, validationOptions)) {
      return;
    }
    const language = await Language.findById(id);
    if (!language) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "language_not_found",
      });
    }

    if (title !== undefined) language.title = title || language.title;
    if (transliteration !== undefined)
      language.transliteration = transliteration || language.transliteration;
    if (flag !== undefined) language.flag = flag || language.flag;
    if (code !== undefined) language.code = code || language.code;
    if (active !== undefined) {
      language.active = active;
    }
    console.log("user---------", req.user);

    await language.save();

    void logActivity({
      user: req.user._id,
      userType: req.user.userType || req.user.accountState?.userType,
      action: "Language Updated",
      detail: `Updated Language ${language.title}`,
      module: "language",
      targetId: language._id,
      metadata: {
        code: language.code,
        active: language.active,
      },
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "language_updated_success",
      data: language,
    });
  } catch (error) {
    // Handle validation errors from Mongoose
    const statusCode = error.name === "ValidationError" ? 400 : 500;
    const translationKey =
      error.name === "ValidationError"
        ? Object.values(error.errors)[0].message
        : error.message;

    return sendResponse({
      res,
      statusCode,
      translationKey,
      error,
    });
  }
};

// Delete a language by ID
const deleteLanguage = async (req, res) => {
  const { id } = req.params;

  try {
    const validationOptions = {
      pathParams: ["id"],
      objectIdFields: ["id"],
    };

    if (!validateParams(req, res, validationOptions)) {
      return;
    }
    const language = await Language.findById(id);
    if (!language) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "language_not_found",
      });
    }

    await language.deleteOne();

    void logActivity({
      user: req.user._id,
      userType: req.user.userType || req.user.accountState?.userType,
      action: "Language Deleted",
      detail: `Deleted Language ${language.title}`,
      module: "language",
      targetId: language._id,
      metadata: {
        code: language.code,
      },
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "language_deleted_success",
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
  createLanguage,
  getLanguages,
  updateLanguage,
  deleteLanguage,
};
