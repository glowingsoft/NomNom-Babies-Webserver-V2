const express = require("express");
const {
  uploadFile,
  getFileByName,
  getFileDetails,
  getAllFiles,
} = require("../controllers/uploadController");
const createRateLimiter = require("../../helperUtils/rateLimiter");

const router = express.Router();

const apiRateLimiter = createRateLimiter("upload", 10, 20);
router.post("/", apiRateLimiter, uploadFile);

router.get("/:filename", getFileByName);

router.get("/details/:filename", getFileDetails);

router.get("/", getAllFiles);

module.exports = router;
