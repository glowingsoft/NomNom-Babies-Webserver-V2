const express = require("express");
const {
  uploadFiles,
  deleteFiles,
} = require("../controllers/uploadAWSController");

const router = express.Router();

router.post("/", uploadFiles);
router.delete("/", deleteFiles);

module.exports = router;
