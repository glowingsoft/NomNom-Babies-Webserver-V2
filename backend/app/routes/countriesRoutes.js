const express = require("express");

const auth = require("@middlewares/authMiddleware");
const {
  getCountries,
  getCountryById,
  selectCountries,
} = require("@controllersCommonModules/countriesController");

const router = express.Router();

router.get("/", auth, getCountries);

router.get("/:id", auth, getCountryById);

router.post("/select", auth, selectCountries);

module.exports = router;
