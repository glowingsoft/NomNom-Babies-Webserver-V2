const fs = require('fs');
const i18n = require('i18n');
const path = require('path');

const directory = path.join(__dirname, '../assets/locales');

// One JSON file per supported language (en, fr, hi); adding a file adds the locale.
i18n.configure({
  locales: fs
    .readdirSync(directory)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.basename(f, '.json')),
  directory,
  defaultLocale: 'en',
  queryParameter: 'lang',
  cookie: 'lang',
  objectNotation: true,
  updateFiles: false,
  autoReload: true,
  syncFiles: false,
});

module.exports = { i18nConfig: i18n };
