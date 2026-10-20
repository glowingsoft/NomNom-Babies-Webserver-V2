const express = require("express");
const {
  createContactRequest,
} = require("../controllers/contactUsController");
const createRateLimiter = require("../../helperUtils/rateLimiter");

const router = express.Router();
const contactRateLimiter = createRateLimiter("contact", 10, 5);

router.post("/", contactRateLimiter, createContactRequest);

module.exports = router;
