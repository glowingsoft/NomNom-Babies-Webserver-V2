const {
  getLanguages,
  updateUserLanguage,
  getTranslations,
} = require("@controllersCommonModules/languageController");
const auth = require("@middlewares/authMiddleware");
const express = require("express");

const router = express.Router();

router.get("/", getLanguages);
router.get("/:code/translations", getTranslations);
router.put("/user", auth, updateUserLanguage);

module.exports = router;
