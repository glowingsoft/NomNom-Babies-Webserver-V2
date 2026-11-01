const express = require("express");
const { getMedia } = require("../controllers/mediaController");

const router = express.Router();

router.get("/:key", getMedia);

module.exports = router;
