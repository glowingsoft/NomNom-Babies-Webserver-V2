// Loads the mobile app's texts (backend/assets/app-translations/<code>.json, copied from the app's src/i18n/locales)
// into the languages collection, where the admin panel edits them and the app downloads them.
//   - en.json is the source of truth for keys: English is replaced, and keys the app no longer uses are dropped
//     from every language.
//   - other languages only gain keys they don't have yet, so translations edited in the admin panel are kept
//     (pass --force to overwrite them with the files).
//   - a language is created if missing, and stays inactive until every key is translated.
// usage: node backend/scripts/syncAppTranslations.js [--env .env.dev] [--force]
const path = require("path");
const fs = require("fs");

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};
require("dotenv").config({
  path: path.join(__dirname, "../..", arg("--env") || ".env.dev"),
});
const mongoose = require("mongoose");

const FORCE = process.argv.includes("--force");
const DIR = path.join(__dirname, "../assets/app-translations");
// Shown in the app's language picker when the script creates the language.
const META = {
  en: { title: "English", transliteration: "English", flag: "🇺🇸" },
  fr: { title: "French", transliteration: "Français", flag: "🇫🇷" },
  hi: { title: "Hindi", transliteration: "हिन्दी", flag: "🇮🇳" },
};

const read = (code) => JSON.parse(fs.readFileSync(path.join(DIR, `${code}.json`), "utf8"));
const same = (a = {}, b = {}) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  if (!process.env.BASE_URL) throw new Error("BASE_URL is not set");
  await mongoose.connect(process.env.BASE_URL);
  const languages = mongoose.connection.collection("languages");
  const base = read("en");
  const codes = fs.readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => path.basename(f, ".json"));
  const existing = await languages.find({}).toArray();

  for (const lang of existing.filter((l) => !codes.includes(l.code))) codes.push(lang.code);

  for (const code of codes) {
    const file = fs.existsSync(path.join(DIR, `${code}.json`)) ? read(code) : {};
    const doc = existing.find((l) => l.code === code);
    const current = doc?.translations || {};
    const next = {};
    for (const key of Object.keys(base)) {
      const value = code === "en" ? base[key] : FORCE ? file[key] || current[key] : current[key] || file[key];
      if (value) next[key] = value;
    }
    const missing = Object.keys(base).filter((k) => !next[k]).length;
    if (!doc) {
      await languages.insertOne({
        ...(META[code] || { title: code, transliteration: code, flag: "" }),
        image: "",
        code,
        active: missing === 0,
        translations: next,
        translationsVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        __v: 0,
      });
      console.log(`${code}: created (${Object.keys(next).length} texts, ${missing} missing)`);
      continue;
    }
    if (same(current, next)) {
      console.log(`${code}: up to date (v${doc.translationsVersion || 0}, ${missing} missing)`);
      continue;
    }
    const set = { translations: next, translationsVersion: (doc.translationsVersion || 0) + 1, updatedAt: new Date() };
    // Never leave an incomplete language selectable.
    if (missing && code !== "en" && doc.active) set.active = false;
    await languages.updateOne({ _id: doc._id }, { $set: set });
    console.log(`${code}: updated to v${set.translationsVersion} (${missing} missing${set.active === false ? ", deactivated" : ""})`);
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
