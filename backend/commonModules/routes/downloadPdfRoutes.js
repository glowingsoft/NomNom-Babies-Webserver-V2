const {
  downloadGroceryPdf,
  downloadRecipePdf,
  downloadFeedingTimeTablePdf,
  getDownloadedPdfs,
} = require("@controllersCommonModules/downloadPdfController");
const auth = require("@middlewares/authMiddleware");
const express = require("express");

const router = express.Router();

router.get("/feeding-timetable", auth, downloadFeedingTimeTablePdf);

router.get("/recipe/:recipeId", auth, downloadRecipePdf);

router.get("/grocery-list", auth, downloadGroceryPdf);

router.get("/", auth, getDownloadedPdfs);

module.exports = router;
