let filter;

async function initTextModeration() {
  const { Filter } = await import("bad-words");
  filter = new Filter();
}

function extractStrings(obj, results = []) {
  if (!obj) return results;

  if (typeof obj === "string") {
    results.push(obj);
    return results;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      extractStrings(item, results);
    }
    return results;
  }

  if (typeof obj === "object" && obj.constructor === Object) {
    for (const key of Object.keys(obj)) {
      extractStrings(obj[key], results);
    }
  }

  return results;
}

function textModerationMiddleware(req, res, next) {

  const excludedRoutes = [
    "/api/app/payments/cards",
    "/api/webhooks",
    // Admin-written app texts in every language: the English word list misreads foreign words
    // (e.g. French "aujourd’hui" → "hui").
    "/api/admin/languages"
  ];

  if (excludedRoutes.some(route => req.originalUrl.startsWith(route))) {
    return next();
  }

  if (!["POST", "PUT", "PATCH"].includes(req.method)) {
    return next();
  }

  if (!filter) {
    return next();
  }

  if (!req.body || typeof req.body !== "object") {
    return next();
  }

  const strings = extractStrings(req.body);

  for (const text of strings) {
    if (typeof text !== "string") continue;

    if (filter.isProfane(text)) {
      return res.status(400).json({
        message: "Inappropriate language detected",
      });
    }
  }

  next();
}

module.exports = {
  textModerationMiddleware,
  initTextModeration,
};