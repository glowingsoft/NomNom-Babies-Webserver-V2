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
} = require("../controllers/authController");
const createRateLimiter = require("@utils/rateLimiter");

const router = express.Router();
// Create a rate limiter for signup routes
// Define rate limiters
const signupRateLimiter = createRateLimiter("register", 15, 15); // 15 requests per 15 minutes
const loginRateLimiter = createRateLimiter("login", 15, 15); // 15 requests per 15 minute
const generateOtpRateLimiter = createRateLimiter("forgotPassword", 15, 15); // 15 requests per 15 minutes
const resendOtpRateLimiter = createRateLimiter("resendOtp", 15, 15); // 15 requests per 15 minutes
const verifyOtpRateLimiter = createRateLimiter("verifyOtp", 15, 15); // 10 requests per 10 minutes

const resetPasswordRateLimiter = createRateLimiter("resetPassword", 15, 15); // 15 requests per 15 minutes
const changePasswordRateLimiter = createRateLimiter("changePassword", 15, 15); // 15 requests per 15 minutes

// Apply rate limiters to routes
router.post("/register", signupRateLimiter, register);
router.post("/login", loginRateLimiter, login);
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
router.post("/social-auth", socialAuth);

module.exports = router;
