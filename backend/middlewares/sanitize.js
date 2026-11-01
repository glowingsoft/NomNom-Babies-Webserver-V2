// Strips MongoDB operator keys ("$ne", "$gt", "$where", …) from request bodies and query strings, so user
// input can never become a query operator (NoSQL injection). Query params left empty are removed.
const clean = (value) => {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    for (const key of Object.keys(value)) {
      if (key.startsWith("$")) delete value[key];
      else value[key] = clean(value[key]);
    }
  }
  return value;
};

const sanitize = (req, res, next) => {
  if (req.body && typeof req.body === "object") clean(req.body);
  if (req.query && typeof req.query === "object") {
    for (const key of Object.keys(req.query)) {
      const v = clean(req.query[key]);
      if (v && typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length) delete req.query[key];
    }
  }
  next();
};

module.exports = sanitize;
