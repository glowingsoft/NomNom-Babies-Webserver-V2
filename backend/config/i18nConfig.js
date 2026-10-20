const i18n = require('i18n');
const path = require('path');

i18n.configure({
  locales: ['en'],
  directory: path.join(__dirname, '../assets/locales'),
  defaultLocale: 'en',
  queryParameter: 'lang',
  cookie: 'lang',
  objectNotation: true,
  updateFiles: false,
  autoReload: true,
  syncFiles: true,
});

module.exports = { i18nConfig: i18n };
