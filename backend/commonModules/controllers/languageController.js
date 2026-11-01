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

const getLanguages = async (req, res) => {
  try {
    const { page, limit, skip } = parsePaginationParams(req);

    const query = {
      active: true,
    };

    const totalRecords = await Language.countDocuments(query);
    const languages = await Language.find(query)
      .sort({ title: 1 })
      .skip(skip)
      .limit(limit);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "languages_fetched_success",
      data: languages,
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

const updateUserLanguage = async (req, res) => {
  const { _id: userId } = req.user;
  const { languageId } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "user_not_found",
      });
    }

    const language = await Language.findById(languageId);
    if (!language) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "language_not_found",
      });
    }

    user.language = language.code;
    await user.save();
    void logActivity({
      user: user._id,
      userType: user.userType,
      action: "Language Preference Updated",
      detail: `${user.name} changed preferred language to "${language.title}"`,
      module: "language",
      targetId: user._id,
      metadata: {
        languageCode: language.code,
      },
    });
    userCache.del(userId.toString());
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "user_language_updated_success",
      data: { userId, code: language.code },
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

// GET /languages/:code/translations?version=n — public (the app loads its texts before login).
// Answers { upToDate: true } when the app already has this version, so unchanged texts aren't re-sent.
const getTranslations = async (req, res) => {
  try {
    const code = String(req.params.code || "").toLowerCase();
    const language = await Language.findOne({ code, active: true })
      .select("+translations")
      .lean();
    if (!language) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "language_not_found",
      });
    }
    const version = language.translationsVersion || 0;
    res.set("Cache-Control", "no-cache");
    if (Number(req.query.version) === version) {
      return sendResponse({
        res,
        statusCode: 200,
        translationKey: "translations_fetched",
        data: { code, version, upToDate: true },
      });
    }
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "translations_fetched",
      data: { code, version, translations: language.translations || {} },
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
  getLanguages,
  updateUserLanguage,
  getTranslations,
};
