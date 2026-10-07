const {
  getLanguages,
  updateUserLanguage,
} = require("@controllersCommonModules/languageController");
const auth = require("@middlewares/authMiddleware");
const express = require("express");

const router = express.Router();

router.get("/", getLanguages);
router.put("user", auth, updateUserLanguage);

module.exports = router;
