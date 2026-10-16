const { sendResponse } = require("@utils/responseUtil");

const roleMiddleware = (allowedRoles) => (req, res, next) => {
  const userRole = req.user?.role || req.user?.userType || req.user?.accountState?.userType;

  if (allowedRoles.includes(userRole)) {
    next();
  } else {
    sendResponse({
      res,
      statusCode: 403,
      translationKey: `Access denied. ${allowedRoles.join(" or ")} only.`,
      error: `Access denied. ${allowedRoles.join(" or ")} only.`,
    });
  }
};

module.exports = roleMiddleware;

//e.g usage app.use("/shared-route", roleMiddleware(["admin", "trainer"]), (req, res) => {
