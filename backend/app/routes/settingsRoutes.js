const express = require("express");
const {
  getTermsAndConditions,
  getAboutUs,
  getPrivacyPolicy,
  getFaqs
} = require("../../commonModules/controllers/settingsController");
const createRateLimiter = require("@utils/rateLimiter");

const router = express.Router();

const apiRateLimiter = createRateLimiter("AdminSettings");

router.get("/terms-conditions", apiRateLimiter, getTermsAndConditions);

router.get("/about-us", apiRateLimiter, getAboutUs);

router.get("/privacy-policy", apiRateLimiter, getPrivacyPolicy);

router.get("/faqs", apiRateLimiter, getFaqs);

module.exports = router;
