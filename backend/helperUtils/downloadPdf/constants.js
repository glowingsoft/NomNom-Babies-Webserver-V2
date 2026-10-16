// Theme colors
const PRIMARY = "#F2692B";
const SUCCESS = "#22C55E";
const WARNING = "#F59E0B";
const DARK = "#222222";
const GRAY = "#666666";
const LIGHT = "#E5E7EB";
const CARD = "#FAFAFA";
const CHIP_BG = "#FFF1EA";

// Page dimensions
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Consistent font scale — every text element in every generated PDF
// should pull its size from here based on its "level", not a hardcoded number.
const FONT_SIZES = {
  pageTitle: 22,
  pageSubtitle: 10,
  sectionTitle: 14,
  label: 10.5,
  body: 10,
  small: 9,
};

// Set this once you have the logo file, e.g.:
// const path = require("path");
// const LOGO_PATH = path.join(__dirname, "../assets/logo.png");
const LOGO_PATH = null;
const LOGO_SIZE = 36;

module.exports = {
  PRIMARY,
  SUCCESS,
  WARNING,
  DARK,
  GRAY,
  LIGHT,
  CARD,
  CHIP_BG,
  PAGE_WIDTH,
  PAGE_HEIGHT,
  MARGIN,
  CONTENT_WIDTH,
  FONT_SIZES,
  LOGO_PATH,
  LOGO_SIZE,
};
