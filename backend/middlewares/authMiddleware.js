const { verifyAccessToken, isSessionActive } = require("@utils/authTokens");
const { User } = require("@models/UserModel");
const { sendResponse } = require("@utils/responseUtil");
const { i18nConfig } = require("@config/i18nConfig");
const { userCache } = require("@config/nodeCache");

// Accounts in these states can't use the API even with a token issued before the change.
const BLOCKED_STATUSES = ["restricted", "suspended", "softDeleted", "hardDeleted"];

const hasField = (obj, path) => {
  return (
    path.split(".").reduce((o, key) => (o ? o[key] : undefined), obj) !==
    undefined
  );
};

const auth = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");
    if (!authHeader) {
      return sendResponse({
        res,
        statusCode: 401,
        translationKey: "auth_header_missing",
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return sendResponse({
        res,
        statusCode: 401,
        translationKey: "auth_token_missing",
      });
    }

    // Only short-lived access tokens of a live sign-in (logout / password change / theft detection revoke it).
    const decoded = verifyAccessToken(token);
    if (!(await isSessionActive(decoded.sid))) {
      return sendResponse({
        res,
        statusCode: 401,
        translationKey: "session_expired",
      });
    }
    const userId = decoded._id;

    let user = userCache.get(userId);

    const requiredFields = [
      "name",
      "timezone",
      "language",
      "role",
      "status",
    ];

    const isMissingRequiredFields =
      !user || requiredFields.some((field) => !hasField(user, field));

    if (!user || isMissingRequiredFields) {
      const selectFields =
        "name email timezone language accountState.userType accountState.status";
      user = await User.findById(userId).select(selectFields);

      if (!user) {
        return sendResponse({
          res,
          statusCode: 401,
          translationKey: "user_not",
        });
      }

      user = user.toObject();
      user.role = user.accountState.userType;
      user.userType = user.accountState.userType;
      user.status = user.accountState.status || "active";
      delete user.accountState;

      userCache.set(userId, user);
    }

    if (BLOCKED_STATUSES.includes(user.status)) {
      return sendResponse({
        res,
        statusCode: user.status.endsWith("Deleted") ? 401 : 403,
        translationKey: user.status.endsWith("Deleted")
          ? "user_not"
          : "your_account_2",
      });
    }

    i18nConfig.setLocale(req, user.language || "en");
    req.token = token;
    req.sessionId = decoded.sid;
    req.user = user;

    next();
  } catch (error) {
    // "token_expired" tells clients to refresh silently; anything else is a bad token.
    return sendResponse({
      res,
      statusCode: 401,
      translationKey:
        error?.name === "TokenExpiredError" ? "token_expired" : "invalid_token",
    });
  }
};

module.exports = auth;
