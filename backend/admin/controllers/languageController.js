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

// GET /admin/languages/translations — every app text key with one column per language (central editor).
const getAllTranslations = async (req, res) => {
  try {
    const languages = await Language.find({})
      .select("+translations")
      .sort({ code: 1 })
      .lean();
    const base = languages.find((l) => l.code === BASE_LANGUAGE);
    const keys = Object.keys(base?.translations || {}).sort();
    // English first, then the rest alphabetically.
    languages.sort((a, b) =>
      a.code === BASE_LANGUAGE ? -1 : b.code === BASE_LANGUAGE ? 1 : 0,
    );
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "translations_fetched",
      data: {
        languages: languages.map((l) => ({
          _id: l._id,
          code: l.code,
          title: l.title,
          active: l.active,
          version: l.translationsVersion || 0,
          missing: missingTranslationKeys(l.translations, base?.translations)
            .length,
        })),
        rows: keys.map((key) => ({
          key,
          values: Object.fromEntries(
            languages.map((l) => [l.code, l.translations?.[key] || ""]),
          ),
        })),
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

// PUT /admin/languages/translations { rows: [{ key, values: { en, fr, … } }], removeKeys?: [key] }
// Upserts texts for any keys/languages (a new key needs its English text) and removes keys from every
// language. Only languages whose texts changed get a new version. Live languages stay live: the app shows
// English for any text that isn't translated yet.
const saveAllTranslations = async (req, res) => {
  if (!validateParams(req, res, { rawData: ["rows"] })) return;
  try {
    const { rows = [], removeKeys = [] } = req.body;
    if (!Array.isArray(rows) || !Array.isArray(removeKeys)) {
      return sendResponse({ res, statusCode: 400, translationKey: "invalid_data" });
    }
    const languages = await Language.find({}).select("+translations");
    const base = languages.find((l) => l.code === BASE_LANGUAGE);
    if (!base) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "base_language_required",
      });
    }
    const KEY = /^[a-z0-9_]{1,64}$/;
    const changed = new Set();
    const baseTexts = { ...(base.translations || {}) };
    for (const row of rows) {
      const key = String(row?.key || "").trim();
      if (!KEY.test(key)) continue;
      const en = row.values?.[BASE_LANGUAGE];
      if (typeof en === "string" && en.trim()) baseTexts[key] = en.trim().slice(0, 2000);
    }
    for (const key of removeKeys) delete baseTexts[key];

    for (const lang of languages) {
      const isBase = lang.code === BASE_LANGUAGE;
      const next = isBase ? baseTexts : { ...(lang.translations || {}) };
      if (!isBase) {
        for (const row of rows) {
          const key = String(row?.key || "").trim();
          const text = row.values?.[lang.code];
          if (!(key in baseTexts) || typeof text !== "string") continue;
          if (text.trim()) next[key] = text.trim().slice(0, 2000);
          else delete next[key];
        }
        // Keys no longer in English are dropped everywhere.
        for (const key of Object.keys(next)) if (!(key in baseTexts)) delete next[key];
      }
      if (JSON.stringify(next) === JSON.stringify(lang.translations || {})) continue;
      lang.translations = next;
      lang.translationsVersion = (lang.translationsVersion || 0) + 1;
      lang.markModified("translations");
      changed.add(lang.code);
    }
    await Promise.all(
      languages.filter((l) => changed.has(l.code)).map((l) => l.save()),
    );

    void logActivity({
      user: req.user._id,
      userType: req.user.userType || req.user.accountState?.userType,
      action: "App Texts Updated",
      detail: `Updated app texts (${[...changed].join(", ") || "no changes"})`,
      module: "language",
      metadata: { rows: rows.length, removed: removeKeys.length, languages: [...changed] },
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "translations_updated",
      data: { changed: [...changed] },
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
  getAllTranslations,
  saveAllTranslations,
  createLanguage,
  getLanguages,
  updateLanguage,
  deleteLanguage,
};
