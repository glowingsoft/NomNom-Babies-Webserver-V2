const express = require("express");
const auth = require("../../middlewares/authMiddleware");

const {
  register,
  login,
  generateOtp,
  resetPassword,
  verifyOtp,
  logout,
  deleteAccount,
  socialAuth,
  forgetPassword,
  changePassword,
  refresh,
} = require("../controllers/authController");
const { attachSessionToResponse } = require("@utils/authTokens");
const createRateLimiter = require("@utils/rateLimiter");

const router = express.Router();
// Sign-in responses carry the refresh token (apps) / set its cookie (web) — see helperUtils/authTokens.js.
router.use(attachSessionToResponse);
const refreshRateLimiter = createRateLimiter("refreshToken", 15, 120, { strict: true });
const signupRateLimiter = createRateLimiter("register", 15, 15, { strict: true });
const loginRateLimiter = createRateLimiter("login", 15, 15, { strict: true });
const generateOtpRateLimiter = createRateLimiter("forgotPassword", 15, 15, { strict: true });
const resendOtpRateLimiter = createRateLimiter("resendOtp", 15, 15, { strict: true });
const verifyOtpRateLimiter = createRateLimiter("verifyOtp", 15, 15, { strict: true });

const resetPasswordRateLimiter = createRateLimiter("resetPassword", 15, 15, { strict: true });
const changePasswordRateLimiter = createRateLimiter("changePassword", 15, 15, { strict: true });

router.post("/register", signupRateLimiter, register);
router.post("/login", loginRateLimiter, login);
router.post("/refresh", refreshRateLimiter, refresh);
router.post("/resend-otp/email", resendOtpRateLimiter, (req, res, next) => {
  req.body.type = "email";
  generateOtp(req, res, next);
});
router.post("/resend-otp/phone", resendOtpRateLimiter, (req, res, next) => {
  req.body.type = "phoneNumber";
  generateOtp(req, res, next);
});
router.post("/verify-otp/email", verifyOtpRateLimiter, (req, res, next) => {
  req.body.type = "email";
  verifyOtp(req, res, next);
});
router.post("/verify-otp/phone", verifyOtpRateLimiter, (req, res, next) => {
  req.body.type = "phoneNumber";
  verifyOtp(req, res, next);
});
router.post("/forget-password", generateOtpRateLimiter, forgetPassword);
router.post("/reset-password", resetPasswordRateLimiter, resetPassword);
router.post("/change-password", auth, changePasswordRateLimiter, changePassword);

router.post("/logout", auth, logout);
router.delete("/delete-account", auth, deleteAccount);
router.get("/me", auth, (req, res) => {
  return res.status(200).json({
    message: "Profile fetched successfully",
    data: req.user,
  });
});
const socialAuthRateLimiter = createRateLimiter("socialAuth", 15, 30, { strict: true });
router.post("/social-auth", socialAuthRateLimiter, socialAuth);

module.exports = router;
