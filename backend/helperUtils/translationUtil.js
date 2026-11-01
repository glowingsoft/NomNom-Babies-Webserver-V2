const Language = require("@models/Language");

// The app's English copy defines every key; other languages translate those keys.
const BASE_LANGUAGE = "en";

const getBaseTranslations = async () => {
  const base = await Language.findOne({ code: BASE_LANGUAGE })
    .select("+translations")
    .lean();
  return base?.translations || {};
};

/** Keys of the base language that `translations` has no text for. */
const missingTranslationKeys = (translations = {}, base = {}) =>
  Object.keys(base).filter(
    (key) =>
      typeof translations[key] !== "string" || !translations[key].trim(),
  );

/** Keeps only base keys with non-empty string values (trimmed, max 2000 chars). */
const cleanTranslations = (input = {}, base = {}, isBase = false) => {
  const out = {};
  Object.entries(input || {}).forEach(([key, value]) => {
    if (!isBase && !(key in base)) return;
    if (!/^[a-z0-9_]{1,64}$/.test(key) || typeof value !== "string") return;
    const text = value.trim().slice(0, 2000);
    if (text) out[key] = text;
  });
  return out;
};

module.exports = {
  BASE_LANGUAGE,
  getBaseTranslations,
  missingTranslationKeys,
  cleanTranslations,
};
