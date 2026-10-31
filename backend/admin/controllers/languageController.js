const { statusCounts } = require("@utils/statusCounts");
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
const {
  BASE_LANGUAGE,
  getBaseTranslations,
  missingTranslationKeys,
  cleanTranslations,
} = require("@utils/translationUtil");

const createLanguage = async (req, res) => {
  const { title, transliteration, flag, code, active } = req.body;

  try {
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
      // A new language has no app texts yet, so it starts inactive until they are all translated.
      active: code?.toLowerCase() === BASE_LANGUAGE ? active : false,
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
      translationKey: "language_created_success",
      data: language,
    });
  } catch (error) {
    if (error.code === 11000) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "language_code_unique_violation",
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
        .select("+translations")
        .sort({ title: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Language.countDocuments(filters),
    ]);

    const base = await getBaseTranslations();
    const formatted = languages.map((item) => ({
      _id: item._id,
      title: item.title,
      transliteration: item.transliteration,
      flag: item.flag,
      code: item.code,
      active: item.active,
      translationsVersion: item.translationsVersion || 0,
      totalTranslations: Object.keys(base).length,
      missingTranslations: missingTranslationKeys(item.translations, base)
        .length,
    }));

    const counts = await statusCounts(Language, {
      path: "active",
      statuses: ["active", "inactive"],
      booleanMap: { true: "active", false: "inactive" },
    });

    const meta = { ...generateMeta(page, limit, totalLanguages), counts };

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "languages_fetched_success",
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
      // Every app text must be translated before users can pick the language.
      if (active && language.code !== BASE_LANGUAGE) {
        const [base, withTexts] = await Promise.all([
          getBaseTranslations(),
          Language.findById(id).select("+translations").lean(),
        ]);
        const missing = missingTranslationKeys(withTexts.translations, base);
        if (!Object.keys(base).length || missing.length) {
          return sendResponse({
            res,
            statusCode: 400,
            translationKey: Object.keys(base).length
              ? "translations_incomplete"
              : "base_language_required",
            values: { missing: missing.length },
          });
        }
      }
      language.active = active;
    }

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

// GET /admin/languages/:id/translations — the English texts (keys) next to this language's translations.
const getLanguageTranslations = async (req, res) => {
  if (!validateParams(req, res, { pathParams: ["id"], objectIdFields: ["id"] }))
    return;
  try {
    const language = await Language.findById(req.params.id)
      .select("+translations")
      .lean();
    if (!language) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "language_not_found",
      });
    }
    const base = await getBaseTranslations();
    const translations = language.translations || {};
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "translations_fetched",
      data: {
        language: {
          _id: language._id,
          title: language.title,
          code: language.code,
          active: language.active,
        },
        isBase: language.code === BASE_LANGUAGE,
        base,
        translations,
        missing: missingTranslationKeys(translations, base),
        version: language.translationsVersion || 0,
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

// PUT /admin/languages/:id/translations { translations: { key: text } } — replaces the texts, bumps the version.
const updateLanguageTranslations = async (req, res) => {
  if (
    !validateParams(req, res, {
      pathParams: ["id"],
      objectIdFields: ["id"],
      rawData: ["translations"],
    })
  )
    return;
  try {
    const language = await Language.findById(req.params.id).select(
      "+translations",
    );
    if (!language) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "language_not_found",
      });
    }
    const isBase = language.code === BASE_LANGUAGE;
    const base = isBase ? {} : await getBaseTranslations();
    const translations = cleanTranslations(
      req.body.translations,
      base,
      isBase,
    );
    const missing = isBase ? [] : missingTranslationKeys(translations, base);
    // An active language must stay complete, or users would see a mix of languages.
    if (language.active && !isBase && missing.length) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "translations_incomplete",
        values: { missing: missing.length },
      });
    }
    language.translations = translations;
    language.translationsVersion = (language.translationsVersion || 0) + 1;
    language.markModified("translations");
    await language.save();

    void logActivity({
      user: req.user._id,
      userType: req.user.userType || req.user.accountState?.userType,
      action: "Language Translations Updated",
      detail: `Updated ${language.title} app texts`,
      module: "language",
      targetId: language._id,
      metadata: {
        code: language.code,
        version: language.translationsVersion,
        missing: missing.length,
      },
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "translations_updated",
      data: {
        version: language.translationsVersion,
        missing,
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
  createLanguage,
  getLanguages,
  updateLanguage,
  deleteLanguage,
  getLanguageTranslations,
  updateLanguageTranslations,
};
