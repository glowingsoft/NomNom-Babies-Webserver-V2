const express = require("express");
const {
  getTermsAndConditions,
  getAboutUs,
  getPrivacyPolicy,
  getFaqs,
  updatePrivacyPolicy,
  updateAboutUs,
  updateFaqs,
  createFaqs,
  deleteFaqs,
  updateTermsAndConditions,
} = require("../../commonModules/controllers/settingsController");
const auth = require("@middlewares/authMiddleware");
const roleMiddleware = require("@middlewares/roleMiddleware");

const router = express.Router();

// GET

router.get(
  "/terms-conditions",
  auth,
  roleMiddleware(["admin"]),
  getTermsAndConditions,
);

router.get("/about-us", auth, roleMiddleware(["admin"]), getAboutUs);

router.get(
  "/privacy-policy",
  auth,
  roleMiddleware(["admin"]),
  getPrivacyPolicy,
);

router.get("/faqs", auth, roleMiddleware(["admin"]), getFaqs);

// UPDATE

router.put(
  "/terms-conditions",
  auth,
  roleMiddleware(["admin"]),
  updateTermsAndConditions,
);

router.put("/about-us", auth, roleMiddleware(["admin"]), updateAboutUs);

router.put(
  "/privacy-policy",
  auth,
  roleMiddleware(["admin"]),
  updatePrivacyPolicy,
);

router.put("/faqs/:id", auth, roleMiddleware(["admin"]), updateFaqs);

// CREATE

router.post("/faqs", auth, roleMiddleware(["admin"]), createFaqs);

// DELETE

router.delete("/faqs/:id", auth, roleMiddleware(["admin"]), deleteFaqs);

module.exports = router;
